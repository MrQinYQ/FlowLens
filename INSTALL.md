# FlowLens 安装手册

## 环境

| 用途 | 要求 |
| --- | --- |
| 本地打开示例或已生成原型 | Python 3.9+、现代桌面浏览器 |
| 生成并完整校验新的 JSON | 上述环境及 Node.js 20+ |
| 使用 skill 整理需求 | 支持本地技能和终端的 Codex 环境 |

没有第三方 npm/pip 运行依赖。不会改模型、API Key、MCP 或全局 Python 配置。macOS / Linux 的命令使用 `python3`；Windows 如无此命令可替换为 `py -3`。本项目在 macOS 实测；Windows/Linux 尚未做本次设备验收。

## 方式一：让 Codex 安装（可复制 prompt）

将完整项目目录或 `flowlens-skill.zip` 提供给 Codex，然后复制下面这段。若没有附文件，请在首句补充本地路径或实际仓库地址；未发布远程仓库时不要猜测 URL。

```text
请安装我提供的 FlowLens 项目/skill 压缩包，并验证安装后可以直接本地查看原型。

先定位源目录：完整项目的技能位于 skills/flowlens；skill 压缩包解压后位于 flowlens。若没有源文件或实际仓库地址，只询问来源位置，不猜 GitHub URL。

阅读源包的 SKILL.md、安装器和环境要求。运行仓库的 python3 scripts/install_skill.py，或技能目录下的 python3 scripts/install.py，把完整 skill（包含 assets/viewer 的源码）复制安装到 ~/.agents/skills/flowlens，不使用依赖源仓库的符号链接。已存在同名目录时先核对是否由该安装器管理；更新时使用 --update 并保留备份。

检查 Python；Node.js 只用于完整数据校验，不把 npm install/pip install 当作启动前提。在当前授权工作目录创建一个新的 flowlens-demo 子目录：从已安装 skill 执行 init；不要直接修改安装目录。使用 skill 内置 serve 启动此目录，读取实际打印的 FLOWLENS_URL，检查页面可打开并展示示例，端口冲突时使用脚本的自动避让，不终止其他进程。

交付：技能实际安装路径、原型工作目录、本地预览地址、已验证和未验证事项。若技能尚未显示，提示刷新技能列表或重启 Codex。不要上传文档、公开发布站点或创建远程仓库。
```

源项目可以放在任意有权限的本地目录。请提供实际路径或压缩包，安装后的运行时不依赖源目录的位置。

## 方式二：命令行安装

### 从项目目录安装

```sh
cd /path/to/flowlens
python3 scripts/install_skill.py
```

### 从独立压缩包安装

解压 `flowlens-skill.zip` 后：

```sh
python3 ./flowlens/scripts/install.py
```

两种方式都会安装到 `~/.agents/skills/flowlens`。可用 `--dest /path/to/skills` 指定技能父目录。当前 Codex 的用户技能目录及自动发现行为参见 [OpenAI 官方技能文档](https://learn.chatgpt.com/docs/build-skills)。安装器不会同时向多个技能位置复制，以免出现重复条目。

### 更新

从新的源包执行同一安装命令并添加 `--update`：

```sh
python3 scripts/install_skill.py --update
```

仅替换本安装器管理的旧版；原文件会备份到默认的 `~/.agents/flowlens-skill-backups/`，实际路径由输出的 `backup` 字段给出。未知同名目录和符号链接不会被覆盖。已生成的原型目录不受更新影响；本次没有自动升级旧原型代码的功能。

## 安装后的首次启动

在希望保存原型的工作目录执行：

```sh
python3 ~/.agents/skills/flowlens/scripts/flowlens.py init --output ./flowlens-demo
python3 ~/.agents/skills/flowlens/scripts/flowlens.py serve --project ./flowlens-demo
```

终端输出类似 `FLOWLENS_URL=http://127.0.0.1:4173`；打开实际输出的地址，保留该服务进程即可查看。端口占用时地址可能为 4174 或之后的端口。停止用 Ctrl+C，不需要重新安装 skill。

生成目录中也包含服务器，之后可不依赖安装目录直接启动：

```sh
cd ./flowlens-demo
python3 tools/serve.py
```

该方式只提供本机静态预览，不上传原型或需求。JSON 内显式指定的 HTTPS 图片仍会向其图片服务器发出请求。

## 用自己的需求

在 Codex 中使用：

```text
使用 $flowlens，把我提供的需求整理成页面原型和交互流程。先核对需求正文可读，在当前目录生成 checkout-prototype，业务内容写入 project.json，已有原型图放入 assets。标注未明确的规则，校验数据并启动本地预览。不要重写查看器或把业务内容写入 skill 安装目录。
```

已有 v1 JSON 时可以直接执行：

```sh
python3 ~/.agents/skills/flowlens/scripts/flowlens.py init --output ./checkout-prototype --data ./checkout.json
python3 ~/.agents/skills/flowlens/scripts/flowlens.py validate ./checkout-prototype/project.json
python3 ./checkout-prototype/tools/serve.py
```

已有图片可加 `--assets ./mockups`；在 JSON 中用 `./assets/filename.png`，热点使用 0–100 百分比并关联当前页发出的 transition。数据结构和完整示例见 [data-format.md](skills/flowlens/references/data-format.md)。

## 常见问题

- **技能没显示**：Codex 会发现新技能；未显示时刷新或重启。可先直接运行安装目录中的脚本，证明运行时可用；这与技能被模型自动选中是两个验证层级。
- **系统没有 Python**：从 Python 官方渠道安装 Python 3.9+；本工具不会自动修改系统解释器。Windows 可先试 `py -3 --version`。
- **没有 Node**：仍可打开内置示例或运行现有项目；`init --data` 会进行基本 JSON 检查，输出 `json-only`，浏览器随后执行完整校验。要在终端做完整校验请安装 Node.js 20+；已有 Node 时输出 `schema`。
- **目录非空**：换一个输出目录。已有项目直接修改自己的 project.json，再验证并刷新。
- **图片不显示**：检查图片是否在服务根目录内、JSON 路径和文件大小写是否正确。仅选择 JSON 不会自动携带本机其他图片。
- **访问不到**：保持服务进程运行，使用实际打印的 URL。不要双击 index.html 通过 file:// 打开；终端沙箱如阻止监听本地端口，只授权对应本地服务即可。
- **刷新后变回示例**：首次不传 `--data` 会使用示例。实际项目应编辑工作目录的 project.json，并在 viewer.config.json 中把 initialProject 指向它。
- **多项目**：当前是独立工作目录/多份数据切换，没有持久项目库、跨设备同步或多人权限管理。
