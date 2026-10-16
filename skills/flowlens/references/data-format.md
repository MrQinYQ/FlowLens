# FlowLens v1 data and image guide

Project JSON and images are the business layer. Do not rewrite the viewer to inject a new product.

## Minimal project

```json
{
  "version": 1, "id": "my-product", "title": "我的产品",
  "description": "说明页面与交互", "demo": false,
  "source": {"label": "需求正文", "status": "已核对"},
  "modules": [{"id": "main", "title": "主流程"}],
  "screens": [
    {"id": "home", "module": "main", "title": "创建", "kind": "form",
     "x": 0, "y": 0, "entry": true, "role": "用户",
     "description": "填写名称后继续", "notes": ["需求中的页面规则"],
     "components": [
       {"type": "heading", "text": "创建记录"},
       {"type": "fields", "fields": [{"id": "name", "label": "名称", "value": ""}]}
     ]},
    {"id": "done", "module": "main", "title": "完成", "kind": "result",
     "x": 440, "y": 0, "components": [{"type": "callout", "text": "创建完成", "tone": "success"}]}
  ],
  "transitions": [
    {"id": "submit", "from": "home", "to": "done", "label": "提交",
     "requiredFields": ["name"], "trigger": "点击按钮", "condition": "名称已填写",
     "outcome": "展示成功反馈", "rules": ["名称为空时不跳转"]}
  ]
}
```

Set `demo:true` for assumptions or illustrative examples; do not mark a source as checked when it has not been read. One stable ID per project, module, screen, interaction or field. Use letters, digits, dots, underscores and hyphens; object reserved words are rejected.

Screens require module, title, finite x/y and components. Default size is 320×320; dimensions must be 220–1200. Common kinds are page/form/dashboard/detail/result. Layout about 440px apart horizontally and 480px vertically leaves room for labels. Cycles, self-links and multiple actions between the same screens are supported. Give success and failure branches different transition IDs and labels.

## Components

| type | Data |
| --- | --- |
| heading / text | text, optional caption |
| stats | items: [{label,value,caption?}] |
| table | columns: string[], rows: arrays of scalar cells; equal column count |
| fields | fields: [{id,label,type?,value?,placeholder?,options?}] |
| callout | text, caption?, tone? |
| list | items: string[] |
| image | src, alt?, hotspots? |

Field types: text, number, select, date, textarea, email, url. A select needs options; nonempty default must be one of them. Number defaults must be numeric, date defaults valid YYYY-MM-DD. Required fields are listed on a transition and must belong to its source screen. Number ranges, URL validity, arbitrary condition expressions, permissions and backend writes are not implemented by explanatory text.

Tones: neutral, accent, success, warning, danger.

## Existing prototype images

```json
{
  "type": "image", "src": "./assets/checkout.png", "alt": "订单确认页",
  "hotspots": [{"transition": "submit", "x": 36, "y": 72, "width": 28, "height": 13}]
}
```

Hotspots use percentages of the displayed image, measured from the top left. They must stay within 0–100 and refer to an interaction starting on this screen. Store local screenshots inside the output workspace; `init --assets` copies an image directory to its assets/ folder. HTTPS sources are supported and make a request to that image server. Relative sources resolve from the served workspace root. Do not use local absolute filesystem paths, file://, data: or scripts as image URLs.

## Existing workspace and startup

Generated projects load `project.json` through `viewer.config.json`. Edit that JSON for subsequent requirements, then validate and refresh. With no supplied data, the demo configuration points to examples/ad-campaign.json. Change initialProject to another local JSON as needed. The config's examples array controls the optional dataset switcher; it is not a persistent project manager.

The output directory contains its own tools/serve.py, so it remains viewable even if the skill is later removed:

```sh
cd /path/to/prototype
python3 tools/serve.py --port 4173
```

## Limits

2 MB JSON, 100 screens, 300 interactions, 30 modules, 40 components per screen. All text renders as text; raw HTML and scripts are not a component type. Import failure preserves the currently loaded project. Export preserves project data and layout, not demonstration input values or history. Browser refresh restores the configured JSON.
