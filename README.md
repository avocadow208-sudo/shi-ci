# 拾词 · 英语挖空练习生成器

把英语单词表 PDF / Word 转成五列、可打印的 Word 挖空练习。

## 功能

- 支持带文字层的 PDF、扫描版 PDF 和 `.docx` 文件
- 扫描 PDF 自动启用中英双语 OCR，并针对双栏课本词表逐栏识别
- 自动过滤音标、词性、页码和 Unit 标题
- 识别结果可逐条修改、删除和补充
- 按比例随机挖空英文或中文，可一键重新随机
- A4 横向固定五列，提供每页 60 / 80 / 100 题三种密度
- 导出可继续编辑的 `.docx`，可选附加答案页
- 全部处理在浏览器本地完成，文件不会上传到服务器

## 本地运行

需要 Node.js 22 或更新版本。

```bash
npm install
npm run dev
```

首次启动会把 OCR 运行文件和中英文识别模型从已安装依赖复制到 `public/ocr`。生产构建：

```bash
npm test
npm run build
```

## 部署到 GitHub Pages

仓库内已包含 `.github/workflows/deploy-pages.yml`。将代码推送到 `main` 后，在仓库的 **Settings → Pages → Build and deployment** 中把 Source 设为 **GitHub Actions**，之后每次推送都会自动部署。

## 样本兼容说明

项目已按“高中英语课本单词”双栏扫描 PDF 的版式验证。扫描识别速度取决于电脑性能，几十页 PDF 首次处理可能需要数分钟；页面会显示逐页进度，语言模型会缓存在浏览器中。

