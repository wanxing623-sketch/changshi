# 识陷 · 公考政治理论挖坑点训练

> 一个**完全离线**的静态练习网页：帮你识别并掌握公考政治理论题中 **9 类常见挖坑点**。
> 无需后端、无需账号、无外部 CDN；打开 `index.html` 即可用。

**线上访问**：https://wanxing623-sketch.github.io/changshi/ （GitHub Pages，由 GitHub Actions 自动部署）

## 为什么做这个

政治理论题失分，很少因为“没背过”，更多是因为选项**挖了坑**：绝对化表述、概念偷换、主次颠倒、范围扩大、主体错位、以偏概全、因果倒置、张冠李戴、数字与时间错位。
本项目不追求题量，而是把“识别套路”本身当作训练目标——每道题都标注**陷阱类型 → 命题陷阱 → 解析 → 解题提示**。

## 功能

- **题库**：36 道原创训练题，9 类挖坑点各 4 题，按陷阱类型**交错编排**（避免连续同型题的机械节奏）
- **即时解析**：作答后立刻展示“命题陷阱 / 解析 / 解题提示”三段式反馈
- **错题攻克**：答错自动进错题本，**连续答对 2 次**才移出（间隔重复 + 测试效应）
- **掌握度仪表**：首页按陷阱类型显示“已练 / 稳定掌握”进度条
- **避坑手册**：9 类陷阱的**命题信号词**与**拆解方法**，可一键跳转对应专项
- **收藏与统计**：每题可收藏；进度、正确率、待攻克数全部保存在本机 `localStorage`
- **界面个性化**：深色/浅色（跟随系统或手动切换）、字号两档、进度一键重置
- **键盘操作**：桌面端全键盘答题
- **离线能力**：`file://` 双击打开即可；在线访问过一次后，Service Worker 缓存支持**断网继续练习**

## 人因工程设计决策

| 人因原则 | 设计落地 |
|---|---|
| 认知负荷控制（工作记忆容量有限） | 一屏一题；先独立作答、后渐进披露解析；页面按“概览 / 练习 / 错题 / 手册”四层以内的扁平导航 |
| 希克定律（选项越多决策越慢） | 导航固定 4 项；筛选 chips 单层直达，无需多级菜单 |
| 菲茨定律（目标越大越易点中） | 选项为整行大按钮，移动端触达面积充足 |
| 即时反馈（行为强化） | 提交即反馈，且反馈指向**具体陷阱名称**而非只判对错 |
| 测试效应 + 间隔重复 | 错题必须**连续答对 2 次**才移出，防止“看懂了解析就当会了” |
| 情境干扰效应（contextual interference） | 题库按 9 类陷阱 round-robin 交错排列，迫使逐题独立判断 |
| 多通道编码（色觉友好） | 对错同时用 **颜色 + ✓/× 符号 + 文字**三重标注，不单靠颜色传意 |
| 个性化适配 | 深浅色跟随 `prefers-color-scheme`、字号可切换、支持 `prefers-reduced-motion` |
| 容错与用户控制 | 进度可一键重置（带确认）；数据仅存本机、离线可用、无网络上报 |
| 可达性 | 全键盘可用（`A–D / 1–4 / Enter / ← → / S`）、`focus-visible` 焦点样式、ARIA 标签 |

### 键盘快捷键（练习页）

| 按键 | 作用 |
|---|---|
| `A`–`D` 或 `1`–`4` | 选择选项 |
| `Enter` | 确认答案 / 查看解析后进入下一题 |
| `←` `→` | 上一题 / 下一题 |
| `S` | 收藏 / 取消收藏当前题 |

## 离线使用

1. **本地文件**：克隆仓库后双击 `index.html`（或拖入浏览器）即可，完全离线。
2. **在线缓存**：通过 GitHub Pages 访问过一次后，断网也能继续练习（Service Worker 缓存）。
3. 进度存在浏览器 `localStorage`：清除浏览器数据会丢失记录，**不会跨设备同步**。

本地预览（任意静态服务器）：

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

## 参考的 GitHub 开源题库与项目

本项目的**分类体系与功能设计**参考了以下开源项目；**全部题目与解析为原创编写**，未复制任何仓库的题目内容，不冒充真题：

| 项目 | 许可 | 参考内容 |
|---|---|---|
| [ERRRC/xingcezhenti](https://github.com/ERRRC/xingcezhenti) | 未声明 | 行测真题的模块与考点组织方式（仅结构参考） |
| [ERRRC/kaogong-shuati](https://github.com/ERRRC/kaogong-shuati) | MIT（题库数据另附限制） | “政治理论”独立模块、模块树刷题、错题本与统计结构 |
| [jangviktor-web/GongkaoNaoku](https://github.com/jangviktor-web/GongkaoNaoku) | Apache-2.0 | 间隔重复（SM-2）、本地优先、错题攻克的机制设计 |
| [TaiMaBenJi/knowledge-commons](https://github.com/TaiMaBenJi/knowledge-commons) | MIT | 零依赖、完全离线的静态学习站架构 |

> 理论表述请以权威原文和考试公告为准；本项目仅供学习参考。

## 部署（GitHub Pages）

`.github/workflows/pages.yml`：推送到 `main` 分支（或手动 `workflow_dispatch`）时，由 GitHub Actions 构建静态产物并部署到 Pages。
仓库 Pages 的构建来源需保持为 **GitHub Actions**（当前已配置）。静态资源全部为相对路径，不依赖外部 CDN。

## 目录结构

```
├── index.html              # 页面骨架
├── style.css               # 样式（含深色模式 / 减少动效 / 响应式）
├── questions.js            # 题库数据（36 题，9 类陷阱，交错编排）
├── app.js                  # 应用逻辑（状态、渲染、键盘、离线、偏好）
├── sw.js                   # Service Worker（离线缓存）
├── manifest.webmanifest    # PWA 清单
├── icon.svg                # 图标
├── test/smoke.js           # 冒烟测试（Node DOM 桩，无需浏览器）
└── .github/workflows/pages.yml
```

## 开发与测试

```bash
node --check app.js && node --check questions.js   # 语法检查
node test/smoke.js                                  # 交互冒烟测试（48 项断言）
node test/smoke.js migrate                          # v1 → v2 记录迁移测试
```

## 许可与免责

题目与解析为原创学习内容，仅供参考，不构成考试依据；如有表述出入，以权威原文为准。
