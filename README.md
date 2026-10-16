# FlowLens · 可复用原型与交互流程

把需求、JSON 或已有原型图片变成可拖动缩放的交互画布。页面缩略原型、流程连线、热点、表单校验、交互说明与演示路径由数据驱动。

本项目同时提供独立网页引擎和自包含的 `flowlens` skill。**运行时代码直接放在 skill 内，安装后无需原仓库即可创建项目并本地启动。**

## 安装与使用

完整步骤及可复制的安装 prompt：**[INSTALL.md](INSTALL.md)**。

```sh
# 在本仓库根目录安装到 ~/.agents/skills/flowlens
python3 scripts/install_skill.py

# 安装后，在任意工作目录生成一个可独立运行的示例
python3 ~/.agents/skills/flowlens/scripts/flowlens.py init --output ./my-prototype
python3 ~/.agents/skills/flowlens/scripts/flowlens.py serve --project ./my-prototype
```

打开终端打印的 `FLOWLENS_URL`。默认尝试 4173，端口被占用会自动选择后续端口，不终止现有进程。预览仅监听 127.0.0.1。查看只需要 Python 3.9+ 和现代桌面浏览器，无需 npm install、pip install 或 API Key。完整校验和开发测试另需 Node.js 20+。

安装完成后可以对 Codex 说：

> 使用 $flowlens，把这份需求整理成可点击的页面原型和交互流程。在当前工作目录生成独立原型项目，启动本地预览，并说明尚未明确的需求。

## 能力与边界

- 点阵画布平移、滚轮缩放、页面拖动、适应全图、小地图导航。
- 选择页面或连线看角色、条件、规则、反馈与关联页面。
- 原型演示执行页面跳转和必填校验，支持成功、异常、循环及多条并行交互。
- 可注入组件式页面或现有原型图片，图片热点按百分比定位。
- JSON 导入导出；安装与更新不改动已生成的项目。
- 当前可切换多套数据，**不含持久化项目库、多人共享、业务后端或演示状态自动保存**。需求正文不可读时应提供示例并标注，不宣称已还原原需求。

## 单一运行时来源

```text
flowlens/
├── INSTALL.md                         安装手册与安装 prompt
├── scripts/                           仓库安装、检查、测试、打包入口
├── tests/                             安装与本地服务集成测试
└── skills/flowlens/
    ├── SKILL.md                       使用流程与触发范围
    ├── agents/openai.yaml             技能展示信息
    ├── scripts/
    │   ├── install.py                 随 skill 分发的安装器
    │   └── flowlens.py                init / serve / validate
    ├── references/data-format.md      数据契约、图片和更新方式
    └── assets/viewer/                 完整、唯一维护的运行时代码
        ├── index.html
        ├── viewer.config.json        初始数据和示例列表
        ├── src/                      查看器、原型、画布、校验、几何
        ├── examples/                 广告投放与订单履约示例
        ├── tools/                    Python 服务及 Node 校验器
        └── tests/                    引擎行为测试
```

仓库包装脚本和安装后的 skill 都使用这份运行时，没有第二份要手工同步的网页源码。安装用实际文件复制，运行不依赖指向仓库的符号链接。用户每次 `init` 获得可编辑、可独立启动的工作目录。

## 注入项目数据

```sh
python3 ~/.agents/skills/flowlens/scripts/flowlens.py init \
  --output ./checkout-prototype \
  --data ./checkout.json \
  --assets ./mockup-images

python3 ~/.agents/skills/flowlens/scripts/flowlens.py validate ./checkout-prototype/project.json
python3 ./checkout-prototype/tools/serve.py
```

`--assets` 可省略；传入时复制到工作目录的 `assets/`，JSON 应使用 `./assets/checkout.png` 等地址。已有工作目录直接修改其 `project.json`，校验后刷新。详细结构见 [数据契约](skills/flowlens/references/data-format.md)。`PrototypeExplorer` 类仍可在其他网页通过 ES modules 引入。

## 开发与分发

```sh
# 不安装 skill，直接启动包内示例
python3 skills/flowlens/scripts/flowlens.py serve --project skills/flowlens/assets/viewer

python3 scripts/test.py
python3 scripts/check.py
python3 scripts/package_skill.py
```

最后一条生成 `dist/flowlens-skill.zip`，其中包含 `flowlens/SKILL.md`、运行时代码、参考资料和安装器。对方解压后可执行 `python3 flowlens/scripts/install.py`，无需取得原仓库。目录本身也可直接复制安装。

测试区分引擎、安装流程、本地 HTTP 和浏览器证据，见 [验证记录](docs/validation.md)。当前实现不自动创建远程 GitHub 仓库或发布网站。
