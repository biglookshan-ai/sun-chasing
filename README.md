# 晷 · SunPath / Sun-Chasing

面向摄影与延时拍摄的**太阳方位规划工具**。根据坐标点显示日出日落时间与**方位角**、蓝调/黄金时刻，可拖动时间轴实时观察太阳与**影子**的变化，并把日出/日落/太阳方向/影子直接叠加在真实地图上。含实验性 **AR 实景投影**模式。

在线地址（部署后）：`https://biglookshan-ai.github.io/sun-chasing/`

## 功能

- **地图选点**：基于 OpenStreetMap，点击地图、拖动标记、搜索地名、GPS 定位、手动输入坐标五种方式选点。
- **实时太阳与影子**：地图上叠加日出方位线、日落方位线、当前太阳方向、真实影子（方向+长度按可调物体高度计算）。
- **时间轴**：拖动滑块看太阳/影子随时间变化；「播放」自动走一遍全天光影；「实时」锁定当前时刻每秒刷新。
- **光线阶段**：实时显示夜/暮光/蓝调/黄金/白昼，并倒计时到下一个关键时刻。
- **一键跳转**：日出 / 晨黄金 / 晨蓝调 / 正午 / 暮黄金 / 暮蓝调 / 日落，点一下直达那一刻。
- **方位罗盘**：极坐标同时表达方位角与太阳高度（越靠圆心太阳越高）。
- **全天高度曲线**：按光线阶段着色的太阳高度剖面图。
- **AR 投影**：相机实景叠加太阳全天轨迹与当前位置（需 HTTPS + 手机传感器）。
- **机位分享**：坐标与日期写入 URL，可收藏/分享。

## 本地运行

因为用到相机与定位，需要通过本地服务器（而非 `file://`）打开：

```bash
# 任选其一
python3 -m http.server 8000
# 或
npx serve .
```

然后浏览器打开 `http://localhost:8000`。注意：`localhost` 下相机/定位可用，但手机访问需 HTTPS（见下方部署）。

## 部署到 GitHub Pages

```bash
git init -b main
git remote add origin https://github.com/biglookshan-ai/sun-chasing.git
git add .
git commit -m "SunPath: full project"
git push -u origin main
```

推送时用你的 GitHub 用户名 + personal access token（在 `github.com/settings/tokens` 生成，勾选 `repo` 权限）认证。

然后在仓库 **Settings → Pages** 中，Source 选 **Deploy from a branch**、Branch 选 **main / (root)**、Save。约 1 分钟后即可访问：

`https://biglookshan-ai.github.io/sun-chasing/`

> 若 push 因远端已有提交被拒，可先 `git pull --rebase origin main` 再 push，或对全新仓库使用 `git push -u origin main --force`。

## 其他部署方式

- **Netlify**：把整个 `sun-chasing` 文件夹拖到 `app.netlify.com/drop`，秒出 HTTPS 网址，无需命令行。
- **任意静态托管**：上传全部文件，保持目录结构即可。

## 技术栈

- 纯前端，无构建步骤：HTML + CSS + 原生 JavaScript
- [Leaflet](https://leafletjs.com/) + OpenStreetMap 瓦片（地图）
- 内置 [SunCalc](https://github.com/mourner/suncalc) 算法（太阳位置与时刻，`js/suncalc.js`）
- DeviceOrientation + getUserMedia（AR 模式）

## 目录结构

```
sun-chasing/
├── index.html        # 页面结构
├── css/style.css     # 样式
├── js/suncalc.js     # 天文核心（纯函数）
├── js/app.js         # 应用逻辑（地图/渲染/交互/AR）
├── .nojekyll         # 关闭 GitHub Pages 的 Jekyll 处理
├── LICENSE
└── README.md
```

## 说明

- 时间按访问设备所在时区显示。
- 城市高楼会提前遮挡地平线，实际见光时间请结合现场判断。
- AR 方位依赖手机磁力计/陀螺仪，不同机型精度不同，竖屏使用最准。

## 许可证

MIT © 2026 biglookshan-ai
