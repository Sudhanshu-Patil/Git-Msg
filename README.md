# Git-Msg 🚀

> AI-powered Git commit message generator for Visual Studio Code.

**Git-Msg** analyzes your staged changes and instantly generates clean, meaningful, and [Conventional Commit](https://www.conventionalcommits.org/)–formatted messages using AI — powered by Gemini or OpenAI.

---

## ✨ Features

- 🔍 **Smart diff analysis** — reads your staged changes to understand what actually changed
- 🤖 **AI-generated messages** — produces clear, context-aware commit messages in seconds
- 📌 **Conventional Commits** — follows the industry-standard commit format out of the box
- ⚡ **One-command workflow** — accessible directly from the VS Code Command Palette
- 🧠 **Multi-provider support** — works with both Gemini and OpenAI
- 🧩 **Lightweight** — minimal footprint, zero clutter

---

## 📸 Preview

```
feat(auth): add JWT validation middleware

- Implement token verification
- Handle expired tokens
- Improve error responses
```

---

## 📦 Installation

### From VSIX (Local / Development)

1. Package the extension:
   ```bash
   vsce package
   ```
2. Open **VS Code** and navigate to the **Extensions** panel (`Ctrl + Shift + X`)
3. Click the `···` menu in the top-right corner
4. Select **Install from VSIX...**
5. Choose the generated `.vsix` file

> VS Code Marketplace publishing is on the roadmap — stay tuned!

---

## 🚀 Usage

1. **Stage your changes:**
   ```bash
   git add .
   ```

2. **Open the Command Palette:**
   ```
   Ctrl + Shift + P  (Windows / Linux)
   Cmd  + Shift + P  (macOS)
   ```

3. **Run the command:**
   ```
   Generate Commit Message
   ```

4. **Review** the generated message, make any edits, and commit.

---

## ⚙️ Configuration

Before using Git-Msg, configure your AI provider in VS Code settings:

| Setting | Description | Required |
|---|---|---|
| `gitMsg.provider` | AI provider to use (`gemini` or `openai`) | ✅ |
| `gitMsg.apiKey` | Your API key for the selected provider | ✅ |
| `gitMsg.model` | Model name override (optional) | ❌ |

**To open settings:**

```
Ctrl + Shift + P → Preferences: Open Settings (UI) → search "Git-Msg"
```

> ⚠️ Your API key is stored locally in VS Code settings and is never transmitted anywhere other than the selected AI provider.

---

## 🧱 Tech Stack

| Technology | Purpose |
|---|---|
| TypeScript | Extension logic |
| VS Code Extension API | Editor integration |
| OpenAI API | AI provider (optional) |
| Gemini API | AI provider (optional) |
| ESLint | Code quality |

---

## 📌 Roadmap

- [ ] Support multiple commit styles (Angular, Gitmoji, etc.)
- [ ] Inline Git diff preview before generation
- [ ] Iterative message refinement
- [ ] Auto-commit option
- [ ] VS Code Marketplace publishing

---

## 🤝 Contributing

Contributions are welcome! If you'd like to propose a major change, please open an issue first to discuss your idea.

```bash
# Clone the repo
git clone https://github.com/your-username/git-msg.git

# Install dependencies
npm install

# Run in development mode
Press F5 in VS Code to launch the Extension Development Host
```

---

## 📄 License

Distributed under the [MIT License](./LICENSE).