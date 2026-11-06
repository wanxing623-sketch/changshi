# 识陷 · 公考政治理论易错训练

一个无需后端、无需账号的静态练习网页。打开 `index.html` 即可离线使用；也可通过 GitHub Pages 访问。进度与收藏保存在当前浏览器的 localStorage，清除浏览器数据会丢失记录，不会跨设备同步。

包含 12 道原创政治理论训练题，按常见命题陷阱分类，提供即时解析、错题回顾和避坑手册。统计以每道题最近一次作答为准；错题答对后移出错题本。内容仅供学习参考，理论表述请以权威原文和考试公告为准。

## 参考与致谢

参考 [ERRRC/xingcezhenti](https://github.com/ERRRC/xingcezhenti) 的题库分类和考点组织。本项目题目与解析为自行编写，不复制或声称是该项目真题。上游仓库未标明许可证。

## 部署

`.github/workflows/pages.yml` 在本会话分支推送时通过 GitHub Actions 部署；仓库 Pages 的构建来源需设为 GitHub Actions。静态资源均为相对路径，不依赖外部 CDN。
