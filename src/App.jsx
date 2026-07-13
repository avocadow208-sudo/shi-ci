import { useCallback, useMemo, useRef, useState } from 'react';
import {
  BookOpenCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  LoaderCircle,
  PencilLine,
  Plus,
  RefreshCw,
  ScanText,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { readVocabularyFile } from './lib/fileReaders';
import { EXPORT_COLUMNS, exportExercisesDocx, getBalancedPagePlan } from './lib/exportDocx';
import { exercisePrompt, makeExercises, parseVocabularyText } from './lib/vocab';

const EXAMPLE_ENTRIES = [
  { id: 'sample-1', english: 'curious', chinese: '好奇的；求知欲强的' },
  { id: 'sample-2', english: 'volunteer', chinese: '志愿者' },
  { id: 'sample-3', english: 'challenge', chinese: '挑战；艰巨任务' },
  { id: 'sample-4', english: 'schedule', chinese: '工作计划；日程安排' },
  { id: 'sample-5', english: 'be attracted to', chinese: '喜爱；被吸引' },
  { id: 'sample-6', english: 'graduate', chinese: '毕业；获得学位' },
  { id: 'sample-7', english: 'responsible', chinese: '负责的；有责任的' },
  { id: 'sample-8', english: 'adventure', chinese: '冒险；奇遇' },
  { id: 'sample-9', english: 'recommend', chinese: '建议；推荐；介绍' },
  { id: 'sample-10', english: 'focus on', chinese: '集中；特别关注' },
];

function ProgressPanel({ progress, onCancel }) {
  const percent = progress.total
    ? Math.round(((progress.page - 1 + (progress.progress || 0)) / progress.total) * 100)
    : 0;
  return (
    <div className="progress-panel" role="status" aria-live="polite">
      <div className="progress-icon"><ScanText size={25} /></div>
      <div className="progress-copy">
        <div className="progress-title">
          <span>{progress.phase || '正在读取文件'}</span>
          <strong>{percent}%</strong>
        </div>
        <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
        <div className="progress-foot">
          <p>{progress.total ? `第 ${progress.page} / ${progress.total} 页` : '正在准备解析器…'} · 首次会加载中英文模型</p>
          <button type="button" onClick={onCancel}>取消扫描</button>
        </div>
      </div>
    </div>
  );
}

function UploadPanel({ onFile, onCancel, busy, progress, error }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const accept = (files) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <section className="upload-section" aria-labelledby="upload-title">
      <div className="section-kicker"><span>01</span> 导入词表</div>
      <h2 id="upload-title">把词表交给我，剩下的自动完成。</h2>
      <p className="section-lead">支持可复制文本和扫描图片两种 PDF，也支持 Word（.docx）。扫描件会自动启用中英双语 OCR。</p>

      <button
        className={`dropzone ${dragging ? 'is-dragging' : ''}`}
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); accept(event.dataTransfer.files); }}
      >
        <input
          ref={inputRef}
          hidden
          type="file"
          accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => accept(event.target.files)}
        />
        <span className="upload-mark"><UploadCloud size={30} strokeWidth={1.8} /></span>
        <span className="drop-title">拖放词表到这里</span>
        <span className="drop-help">或点击选择 PDF / Word 文件</span>
        <span className="file-chips"><i>PDF</i><i>DOCX</i><i>最大 50 MB</i></span>
      </button>

      {busy && <ProgressPanel progress={progress} onCancel={onCancel} />}
      {error && <div className="error-banner"><X size={18} />{error}</div>}

      <div className="trust-row">
        <span><ShieldCheck size={17} /> 文件只在当前浏览器中处理</span>
        <span><Sparkles size={17} /> 自动识别双栏扫描词表</span>
      </div>
    </section>
  );
}

function SettingsPanel({ settings, setSettings, onShuffle, onExport, canExport, exporting }) {
  return (
    <aside className="settings-card">
      <div className="section-kicker"><span>03</span> 排版与导出</div>
      <label className="field-label" htmlFor="title">练习标题</label>
      <input
        id="title"
        className="text-input"
        value={settings.title}
        onChange={(event) => setSettings((value) => ({ ...value, title: event.target.value }))}
      />

      <div className="setting-heading">
        <div>
          <span>挖空比例</span>
          <small>中英文随机混合</small>
        </div>
        <strong>{settings.chineseBlankPercent}% 中文释义</strong>
      </div>
      <input
        className="range"
        aria-label="中文释义挖空比例"
        type="range"
        min="0"
        max="100"
        step="10"
        value={settings.chineseBlankPercent}
        onChange={(event) => setSettings((value) => ({ ...value, chineseBlankPercent: Number(event.target.value) }))}
      />
      <div className="range-labels"><span>只挖英文</span><span>各一半</span><span>只挖中文</span></div>

      <div className="setting-heading density-heading">
        <div><span>Word 页面</span><small>自动均衡分页并填满可打印区域</small></div>
      </div>
      <div className="layout-summary">
        <span><strong>A4</strong><small>竖版</small></span>
        <span><strong>5</strong><small>固定列</small></span>
        <span><strong>100%</strong><small>自动铺满</small></span>
      </div>

      <label className="check-row">
        <input
          type="checkbox"
          checked={settings.includeAnswers}
          onChange={(event) => setSettings((value) => ({ ...value, includeAnswers: event.target.checked }))}
        />
        <span className="fake-check"><Check size={13} /></span>
        <span>在文档末尾附加答案页</span>
      </label>

      <button className="shuffle-button" type="button" onClick={onShuffle} disabled={!canExport}>
        <RefreshCw size={17} /> 重新随机挖空
      </button>
      <button className="export-button" type="button" onClick={onExport} disabled={!canExport || exporting}>
        {exporting ? <LoaderCircle className="spin" size={19} /> : <Download size={19} />}
        {exporting ? '正在生成 Word…' : '导出可打印 Word'}
      </button>
      <p className="export-note"><FileText size={14} /> .docx · A4 竖版 · 五列整页 · 可继续编辑</p>
    </aside>
  );
}

function EntryReview({ entries, setEntries, filename }) {
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const PAGE_SIZE = 36;
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const pageItems = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const update = (id, field, value) => setEntries((items) => items.map((item) => item.id === id ? { ...item, [field]: value } : item));
  const remove = (id) => setEntries((items) => items.filter((item) => item.id !== id));
  const add = () => {
    const item = { id: `manual-${Date.now()}`, english: 'new word', chinese: '新释义' };
    setEntries((items) => [...items, item]);
    setPage(Math.floor(entries.length / PAGE_SIZE));
    setEditingId(item.id);
  };

  return (
    <section className="review-card">
      <div className="review-head">
        <div>
          <div className="section-kicker"><span>02</span> 核对词条</div>
          <h2>识别到 <em>{entries.length}</em> 个词条</h2>
          <p><FileText size={15} /> {filename}</p>
        </div>
        <button type="button" className="add-button" onClick={add}><Plus size={16} /> 添加词条</button>
      </div>
      <div className="entry-table" role="table" aria-label="已识别词条">
        <div className="entry-table-head" role="row"><span>#</span><span>英文</span><span>中文释义</span><span>操作</span></div>
        {pageItems.map((entry, localIndex) => {
          const number = page * PAGE_SIZE + localIndex + 1;
          const editing = editingId === entry.id;
          return (
            <div className="entry-row" role="row" key={entry.id}>
              <span className="entry-number">{String(number).padStart(2, '0')}</span>
              {editing ? (
                <>
                  <input value={entry.english} onChange={(event) => update(entry.id, 'english', event.target.value)} aria-label={`第${number}题英文`} />
                  <input value={entry.chinese} onChange={(event) => update(entry.id, 'chinese', event.target.value)} aria-label={`第${number}题中文`} />
                </>
              ) : (
                <><span className="english-cell">{entry.english}</span><span>{entry.chinese}</span></>
              )}
              <span className="row-actions">
                <button type="button" aria-label={editing ? '完成编辑' : '编辑'} onClick={() => setEditingId(editing ? null : entry.id)}>{editing ? <Check size={15} /> : <PencilLine size={15} />}</button>
                <button type="button" aria-label="删除" onClick={() => remove(entry.id)}><Trash2 size={15} /></button>
              </span>
            </div>
          );
        })}
      </div>
      <div className="pagination">
        <span>第 {page + 1} / {totalPages} 页</span>
        <div>
          <button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} /></button>
          <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button>
        </div>
      </div>
    </section>
  );
}

function PagePreview({ exercises, settings }) {
  const pagePlan = getBalancedPagePlan(exercises.length);
  const firstPage = pagePlan[0] || { count: exercises.length };
  const visible = exercises.slice(0, firstPage.count);
  const columns = Array.from({ length: EXPORT_COLUMNS }, () => []);
  visible.forEach((item, index) => columns[index % EXPORT_COLUMNS].push({ item, number: index + 1 }));

  return (
    <section className="preview-card">
      <div className="preview-toolbar">
        <div><span className="live-dot" />打印预览</div>
        <span>A4 竖版 · 五列整页 · 第 1 页 / {Math.max(1, pagePlan.length)}</span>
      </div>
      <div className="paper-preview density-compact" data-columns={EXPORT_COLUMNS}>
        <div className="paper-head">
          <strong>{settings.title || '英语词汇挖空练习'}</strong>
          <span>姓名：____________　日期：____________</span>
        </div>
        <div className="exercise-columns" style={{ gridTemplateColumns: `repeat(${EXPORT_COLUMNS}, 1fr)` }}>
          {columns.map((column, index) => (
            <div className="paper-column" key={index}>
              {column.map(({ item, number }) => <p key={item.id}><b>{number}.</b>{exercisePrompt(item)}</p>)}
            </div>
          ))}
        </div>
      </div>
      <p className="preview-caption">预览按实际 Word 比例缩放；导出后可直接打印，也可继续修改字体与页边距。</p>
    </section>
  );
}

export default function App() {
  const abortRef = useRef(null);
  const [entries, setEntries] = useState([]);
  const [filename, setFilename] = useState('');
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ phase: '', page: 0, total: 0, progress: 0 });
  const [seed, setSeed] = useState(Date.now());
  const [settings, setSettings] = useState({
    title: '英语词汇挖空练习',
    chineseBlankPercent: 50,
    includeAnswers: true,
  });

  const exercises = useMemo(
    () => makeExercises(entries.length ? entries : EXAMPLE_ENTRIES, settings.chineseBlankPercent, seed),
    [entries, settings.chineseBlankPercent, seed],
  );

  const handleFile = useCallback(async (file) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError('');
    setProgress({ phase: '正在读取文件', page: 0, total: 0, progress: 0 });
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('文件超过 50 MB，请压缩后重试。');
      const text = await readVocabularyFile(file, setProgress, controller.signal);
      const parsed = parseVocabularyText(text);
      if (parsed.length < 2) throw new Error('没有识别到足够的“英文 + 中文释义”词条。可尝试换一份清晰文件。');
      setEntries(parsed);
      setFilename(file.name);
      setSettings((value) => ({ ...value, title: file.name.replace(/\.(pdf|docx?|PDF|DOCX?)$/, '') + ' · 挖空练习' }));
      setSeed(Date.now());
      requestAnimationFrame(() => document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (caught) {
      if (caught?.name === 'AbortError') setError('扫描已取消，可以重新选择文件。');
      else {
        console.error(caught);
        setError(caught?.message || '读取失败，请检查文件后重试。');
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setError('');
    try {
      await exportExercisesDocx(exercises, settings);
    } catch (caught) {
      console.error(caught);
      setError('Word 生成失败，请刷新页面后重试。');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="拾词首页">
          <span className="brand-mark"><BookOpenCheck size={22} /></span>
          <span><strong>拾词</strong><small>VOCAB PRACTICE STUDIO</small></span>
        </a>
        <div className="header-note"><ShieldCheck size={16} /> 本地处理 · 不上传文件</div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={15} /> 从词表到练习，只需一次上传</span>
            <h1>让每一页词表，<br /><em>变成真正的练习。</em></h1>
            <p>自动读取 PDF / Word 中英词表，随机混合挖空中文或英文，并排成 A4 竖版、固定五列、自动铺满的 Word 练习纸。</p>
            <div className="hero-stats">
              <span><strong>5</strong><small>固定列数</small></span>
              <span><strong>A4</strong><small>打印尺寸</small></span>
              <span><strong>100%</strong><small>浏览器本地处理</small></span>
            </div>
          </div>
          <div className="hero-sheet" aria-hidden="true">
            <span className="sheet-label">WEEK 01 · VOCAB</span>
            <div className="sheet-title"><i /> Vocabulary Practice</div>
            <div className="sheet-grid">
              {makeExercises(EXAMPLE_ENTRIES, 50, 8).slice(0, 8).map((item, index) => (
                <p key={item.id}><b>{index + 1}.</b>{exercisePrompt(item)}</p>
              ))}
            </div>
            <div className="sheet-stamp">PORTRAIT<br />PRINT READY</div>
          </div>
        </section>

        <UploadPanel
          onFile={handleFile}
          onCancel={() => abortRef.current?.abort()}
          busy={busy}
          progress={progress}
          error={error}
        />

        <section id="workspace" className={`workspace ${entries.length ? 'has-data' : ''}`}>
          <div className="workspace-main">
            {entries.length ? (
              <EntryReview entries={entries} setEntries={setEntries} filename={filename} />
            ) : (
              <div className="empty-review">
                <FileText size={25} />
                <div><strong>上传后可逐条核对识别结果</strong><span>支持修改、删除或手动补充词条</span></div>
              </div>
            )}
            <PagePreview exercises={exercises} settings={settings} />
          </div>
          <SettingsPanel
            settings={settings}
            setSettings={setSettings}
            onShuffle={() => setSeed(Date.now())}
            onExport={handleExport}
            canExport={entries.length > 0}
            exporting={exporting}
          />
        </section>
      </main>

      <footer>
        <span>拾词 · 把整理时间留给练习</span>
        <span>PDF / DOCX → 五列整页 Word</span>
      </footer>
    </div>
  );
}
