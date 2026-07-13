import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeightRule,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { exerciseAnswer, exercisePrompt } from './vocab.js';

const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const TABLE_HEIGHT = 14200;
export const QUESTION_LINE_SPACING = 150;
export const EXPORT_COLUMNS = 5;
export const TARGET_ROWS_PER_PAGE = 22;
const COLORS = {
  ink: '243235',
  muted: '667477',
  rule: 'D7E0DE',
  accent: '0F766E',
  wash: 'F1F7F5',
};

export function getBalancedPagePlan(itemCount, columns = EXPORT_COLUMNS, targetRows = TARGET_ROWS_PER_PAGE) {
  if (!itemCount) return [];
  const totalRows = Math.ceil(itemCount / columns);
  const pageCount = Math.ceil(totalRows / targetRows);
  const baseRows = Math.floor(totalRows / pageCount);
  const pagesWithExtraRow = totalRows % pageCount;
  let start = 0;

  return Array.from({ length: pageCount }, (_, pageIndex) => {
    const rows = baseRows + (pageIndex < pagesWithExtraRow ? 1 : 0);
    const count = Math.min(itemCount - start, rows * columns);
    const page = { start, count, rows };
    start += count;
    return page;
  });
}

function makeHeader(title, subtitle) {
  return [
    new Paragraph({
      spacing: { after: 45 },
      children: [new TextRun({ text: title || '英语词汇挖空练习', bold: true, size: 26, color: COLORS.ink, font: 'Microsoft YaHei' })],
    }),
    new Paragraph({
      spacing: { after: 90 },
      border: { bottom: { color: COLORS.accent, size: 8, style: BorderStyle.SINGLE, space: 5 } },
      children: [
        new TextRun({ text: subtitle, size: 14, color: COLORS.muted, font: 'Microsoft YaHei' }),
        new TextRun({ text: '　　 姓名：____________　日期：____________', size: 14, color: COLORS.muted, font: 'Microsoft YaHei' }),
      ],
    }),
  ];
}

function compactPrompt(item, answerMode) {
  return (answerMode ? exerciseAnswer(item) : exercisePrompt(item)).replace('　　　　　　', '　　　　');
}

function promptFontSize(text) {
  const visualLength = Array.from(text).reduce((total, character) => total + (/[^\x00-\xff]/.test(character) ? 2 : 1), 0);
  if (visualLength > 52) return 12;
  if (visualLength > 38) return 14;
  return 16;
}

function makeGrid(items, rowCount, answerMode = false, numberOffset = 0) {
  const rows = [];
  const rowHeight = Math.min(720, Math.floor(TABLE_HEIGHT / rowCount));
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const cells = [];
    for (let col = 0; col < EXPORT_COLUMNS; col += 1) {
      const itemIndex = rowIndex * EXPORT_COLUMNS + col;
      const item = items[itemIndex];
      const text = item ? compactPrompt(item, answerMode) : '';
      const fontSize = promptFontSize(text);
      cells.push(new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 35, bottom: 35, left: 55, right: 55 },
        shading: answerMode && rowIndex % 2 === 0 ? { fill: COLORS.wash, type: ShadingType.CLEAR } : undefined,
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.SINGLE, color: COLORS.rule, size: 3 },
          left: { style: BorderStyle.NONE },
          right: col === EXPORT_COLUMNS - 1
            ? { style: BorderStyle.NONE }
            : { style: BorderStyle.SINGLE, color: COLORS.rule, size: 3 },
        },
        children: [new Paragraph({
          spacing: { line: QUESTION_LINE_SPACING, after: 0 },
          keepLines: true,
          children: item ? [
            new TextRun({ text: `${numberOffset + itemIndex + 1}. `, bold: true, color: COLORS.accent, size: 16, font: 'Microsoft YaHei' }),
            new TextRun({ text, color: COLORS.ink, size: fontSize, font: 'Microsoft YaHei' }),
          ] : [new TextRun('')],
        })],
      }));
    }
    rows.push(new TableRow({
      cantSplit: true,
      height: { value: rowHeight, rule: HeightRule.EXACT },
      children: cells,
    }));
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows,
  });
}

function makePages(exercises, options, answerMode = false) {
  const pagePlan = getBalancedPagePlan(exercises.length);
  const result = [];
  pagePlan.forEach((page, pageIndex) => {
    if (pageIndex > 0) result.push(new Paragraph({ children: [new PageBreak()] }));
    const pageItems = exercises.slice(page.start, page.start + page.count);
    result.push(...makeHeader(
      answerMode ? `${options.title || '英语词汇挖空练习'} · 答案` : options.title,
      `${answerMode ? '答案页' : '练习页'} ${pageIndex + 1} / ${pagePlan.length}　·　共 ${exercises.length} 题　·　五列整页排版`,
    ));
    result.push(makeGrid(pageItems, page.rows, answerMode, page.start));
  });
  return result;
}

function safeFilename(value) {
  return (value || '英语词汇挖空练习').replace(/[\\/:*?"<>|]/g, '-').trim();
}

export async function createExercisesDocxBlob(exercises, options) {
  const children = makePages(exercises, options, false);
  if (options.includeAnswers && exercises.length) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...makePages(exercises, options, true));
  }

  const wordDocument = new Document({
    creator: '拾词 · 英语挖空练习生成器',
    title: options.title,
    description: '五列 A4 竖版整页英语词汇挖空练习',
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_WIDTH, height: PAGE_HEIGHT, orientation: 'portrait' },
          margin: { top: 260, right: 260, bottom: 300, left: 260, footer: 150 },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: '拾词 · ', size: 12, color: COLORS.muted, font: 'Microsoft YaHei' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 12, color: COLORS.muted }),
            ],
          })],
        }),
      },
      children,
    }],
  });

  return Packer.toBlob(wordDocument);
}

export async function exportExercisesDocx(exercises, options) {
  const blob = await createExercisesDocxBlob(exercises, options);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${safeFilename(options.title)}.docx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1200);
}
