# 晷 · SunPath / Sun-Chasing

面向摄影 / 延时 / 影视 / 建筑 / 天文的**太阳 + 月亮方位规划工具**。显示日出日落 + 月出月落时间与**方位角**、蓝调/黄金时刻、月相，可拖动时间轴实时观察日月与**影子**变化并叠加在真实地图上；接入**天气预报**判断黄金时刻能否开拍；含**取景器/焦段模拟**（预演太阳/月亮落在画面哪个位置）与实验性 **AR 实景投影**。赛博暗调 UI。

在线地址：`https://biglookshan-ai.github.io/sun-chasing/`

详见开发计划与路线图：[PLAN.md](PLAN.md)。

## 功能（v2.0）

- **地图选点**：OpenStreetMap，点击/拖动标记/搜索地名/GPS/手动坐标五种方式。
- **太阳 + 月亮**：地图叠加日出/日落/月出/月落方位线、当前日月方向、真实影子；罗盘与高度曲线同时呈现太阳与月亮全天轨迹。
- **月相**：月相名 + 照亮比例 + 盈亏（视差 + 大气折射修正，对齐 SunCalc 官方测试值）。
- **天气**：接入 Open-Meteo（免 key），显示云量（总/低）、气温、降水概率、能见度、风；**日落可拍性评分**按日落时刻云量启发式给出。
- **取景器 / 焦段模拟**：选画幅（全画幅/APS-C/M4/3/1 吋/手机）+ 焦段 + 横竖构图，按真实透视把太阳/月亮此刻位置与全天轨迹投到画面里，显示等效焦距与视场角。
- **时间轴**：拖动看日月/影子变化；「播放」走全天；「实时」锁定当前；「现在」一键回到此刻。
- **光线阶段 / 一键跳转 / 机位分享**：夜/暮光/蓝调/黄金/白昼 + 倒计时；日出/黄金/蓝调/正午/日落直达；坐标日期写入 URL。
- **AR 投影**：相机实景叠加**太阳(金) + 月亮(青)**全天轨迹与当前位置、随手机转动的小地图、对准太阳校准、自适应抗抖（需 HTTPS + 手机传感器）。

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
