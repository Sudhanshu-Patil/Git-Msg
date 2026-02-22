import * as vscode from 'vscode';
import * as cp from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface GitExtension {
    getAPI(version: number): GitAPI;
}

interface GitAPI {
    repositories: Repository[];
}

interface Repository {
    rootUri: vscode.Uri;
    inputBox: { value: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_DIFF_CHARS = 12_000; // ~3k tokens — sweet spot for accuracy vs. cost
const NOISE_PATTERNS = [
    /^index [a-f0-9]+\.\.[a-f0-9]+.*$/gm,   // index lines (git metadata)
    /^similarity index \d+%$/gm,              // rename similarity lines
    /^old mode \d+$/gm,                       // file mode changes
    /^new mode \d+$/gm,
    /^Binary files .+ differ$/gm,             // binary file markers
];

// ─── Activation ───────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('git-msg.generate', async () => {
        try {
            // 1. Validate config
            const config = vscode.workspace.getConfiguration('gitMsg');
            const apiKey = config.get<string>('geminiApiKey');
            const modelName = config.get<string>('model') || 'gemini-2.0-flash';

            if (!apiKey) {
                vscode.window.showErrorMessage(
                    'Git-Msg: No API key found. Add it via Settings → gitMsg.geminiApiKey'
                );
                return;
            }

            // 2. Validate Git
            const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
            if (!gitExtension) {
                vscode.window.showErrorMessage('Git-Msg: VS Code Git extension not found.');
                return;
            }
            if (!gitExtension.isActive) {
                await gitExtension.activate();
            }

            const git = gitExtension.exports.getAPI(1);
            if (!git.repositories?.length) {
                vscode.window.showErrorMessage('Git-Msg: No Git repository is open.');
                return;
            }

            const repo = git.repositories[0];
            const rootPath = repo.rootUri.fsPath;

            // 3. Gather context (diff + metadata)
            const [rawDiff, stagedFiles, branchName] = await Promise.all([
                getGitDiff(rootPath),
                getStagedFiles(rootPath),
                getBranchName(rootPath),
            ]);

            if (!rawDiff.trim()) {
                vscode.window.showWarningMessage('Git-Msg: No staged changes found. Run "git add" first.');
                return;
            }

            // 4. Generate message with progress indicator
            const message = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Git-Msg: Generating commit message…',
                    cancellable: false,
                },
                async () => {
                    const cleanDiff = preprocessDiff(rawDiff);
                    return generateCommitMessage(cleanDiff, stagedFiles, branchName, apiKey, modelName);
                }
            );

            if (message) {
                repo.inputBox.value = message;
                vscode.window.showInformationMessage('Git-Msg: Commit message ready ✓');
            }

        } catch (err: any) {
            vscode.window.showErrorMessage(`Git-Msg Error: ${err.message}`);
            console.error('[Git-Msg]', err);
        }
    });

    context.subscriptions.push(disposable);
}

// ─── Git Helpers ──────────────────────────────────────────────────────────────

function execCommand(command: string, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        cp.exec(command, { cwd }, (err, stdout, stderr) => {
            if (err) { return reject(new Error(stderr || err.message)); }
            resolve(stdout.trim());
        });
    });
}

const getGitDiff    = (rootPath: string) => execCommand('git diff --cached', rootPath);
const getStagedFiles = (rootPath: string) => execCommand('git diff --cached --name-status', rootPath);
const getBranchName  = (rootPath: string) => execCommand('git rev-parse --abbrev-ref HEAD', rootPath);

// ─── Diff Preprocessing ───────────────────────────────────────────────────────

/**
 * Strips noisy metadata from the diff so the model focuses on actual changes.
 * Also trims to a safe token budget.
 */
function preprocessDiff(rawDiff: string): string {
    let diff = rawDiff;

    // Remove known noise lines
    for (const pattern of NOISE_PATTERNS) {
        diff = diff.replace(pattern, '');
    }

    // Collapse repeated blank lines
    diff = diff.replace(/\n{3,}/g, '\n\n');

    // If still too long, trim and warn in the diff itself so the model is aware
    if (diff.length > MAX_DIFF_CHARS) {
        diff = diff.slice(0, MAX_DIFF_CHARS) + '\n\n[... diff truncated for length ...]';
    }

    return diff.trim();
}

// ─── AI Generation ────────────────────────────────────────────────────────────

async function generateCommitMessage(
    diff: string,
    stagedFiles: string,
    branchName: string,
    apiKey: string,
    modelName: string
): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
            temperature: 0.2,        // Lower = more deterministic, less "creative"
            topP: 0.9,
            maxOutputTokens: 256,    // Commit messages should never be long
        },
    });

    const prompt = buildPrompt(diff, stagedFiles, branchName);
    const result = await model.generateContent(prompt);
    const text   = result.response.text().trim();

    // Strip accidental markdown code fences the model sometimes adds
    return text.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
}

/**
 * A structured, few-shot prompt that produces consistent Conventional Commit output.
 *
 * Why few-shot examples? They anchor the format far more reliably than
 * instructions alone, especially for short-output tasks like commit messages.
 */
function buildPrompt(diff: string, stagedFiles: string, branchName: string): string {
    return `
You are an expert software engineer writing Git commit messages.

## Context
Branch: ${branchName}
Staged files:
${stagedFiles}

## Rules
- Use Conventional Commits format: <type>(<scope>): <short summary>
- Allowed types: feat, fix, refactor, chore, docs, style, test, perf, ci
- Scope is optional but use it when the change is clearly scoped to one area
- Summary line: max 72 characters, imperative mood ("add" not "added"), no period
- Body (optional): explain WHAT changed and WHY, not HOW. Use bullet points.
- Do NOT include a footer unless there is a breaking change (BREAKING CHANGE: ...)
- Return ONLY the commit message. No explanations, no markdown fences, no quotes.

## Examples

### Example 1
Diff: adds a new /health route that returns 200 OK
Output:
feat(api): add health check endpoint

### Example 2
Diff: fixes null pointer when user.profile is undefined
Output:
fix(profile): handle undefined user profile on load

### Example 3
Diff: extracts auth logic into useAuth hook, removes duplicate code in Login and Signup
Output:
refactor(auth): extract auth logic into useAuth hook

- Move shared auth state to useAuth
- Remove duplicated logic from Login and Signup components

## Now write the commit message for this diff

${diff}
`.trim();
}

// ─── Deactivation ─────────────────────────────────────────────────────────────

export function deactivate() {}