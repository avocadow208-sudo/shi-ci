import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
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
const COLORS = {
  ink: '243235',
  muted: '667477',
  rule: 'D7E0DE',
  accent: '0F766E',
  wash: 'F1F7F5',
};

export const DENSITY = {
  comfortable: { label: '舒展', font: 18, spacing: 150, rows: { 1: 24, 2: 22, 3: 20, 4: 17, 5: 14 } },
  compact: { label: '紧凑', font: 16, spacing: 115, rows: { 1: 30, 2: 28, 3: 25, 4: 21, 5: 18 } },
  maximum: { label: '极致', font: 14, spacing: 85, rows: { 1: 36, 2: 34, 3: 30, 4: 26, 5: 22 } },
};

export function normalizeColumnCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(5, Math.max(1, Math.round(parsed)));
}

export function getExercisesPerPage(densityKey = 'compact', columnCount = 3) {
  const density = DENSITY[densityKey] || DENSITY.compact;
  const columns = normalizeColumnCount(columnCount);
  return density.rows[columns] * columns;
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

function makeGrid(items, density, columnCount, answerMode = false, numberOffset = 0) {
  const rows = [];
  const rowsPerPage = Math.ceil(items.length / columnCount);
  for (let rowIndex = 0; rowIndex < rowsPerPage; rowIndex += 1) {
    const cells = [];
    for (let col = 0; col < columnCount; col += 1) {
      const itemIndex = rowIndex * columnCount + col;
      const item = items[itemIndex];
      const text = item ? (answerMode ? exerciseAnswer(item) : exercisePrompt(item)) : '';
      cells.push(new TableCell({
        width: { size: 100 / columnCount, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.TOP,
        margins: { top: 35, bottom: 35, left: 55, right: 55 },
        shading: answerMode && rowIndex % 2 === 0 ? { fill: COLORS.wash, type: ShadingType.CLEAR } : undefined,
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.SINGLE, color: COLORS.rule, size: 3 },
          left: { style: BorderStyle.NONE },
          right: col === columnCount - 1
            ? { style: BorderStyle.NONE }
            : { style: BorderStyle.SINGLE, color: COLORS.rule, size: 3 },
        },
        children: [new Paragraph({
          spacing: { line: density.spacing, after: 0 },
          keepLines: true,
          children: item ? [
            new TextRun({ text: `${numberOffset + itemIndex + 1}. `, bold: true, color: COLORS.accent, size: density.font, font: 'Microsoft YaHei' }),
            new TextRun({ text, color: COLORS.ink, size: density.font, font: 'Microsoft YaHei' }),
          ] : [new TextRun('')],
        })],
      }));
    }
    rows.push(new TableRow({ cantSplit: true, children: cells }));
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows,
  });
}

function makePages(exercises, options, answerMode = false) {
  const density = DENSITY[options.density] || DENSITY.compact;
  const columnCount = normalizeColumnCount(options.columnCount);
  const perPage = getExercisesPerPage(options.density, columnCount);
  const result = [];
  for (let start = 0; start < exercises.length; start += perPage) {
    if (start > 0) result.push(new Paragraph({ children: [new PageBreak()] }));
    const pageItems = exercises.slice(start, start + perPage);
    const pageNumber = Math.floor(start / perPage) + 1;
    result.push(...makeHeader(
      answerMode ? `${options.title || '英语词汇挖空练习'} · 答案` : options.title,
      `${answerMode ? '答案页' : '练习页'} ${pageNumber}　·　共 ${exercises.length} 题　·　${columnCount} 列排版`,
    ));
    result.push(makeGrid(pageItems, density, columnCount, answerMode, start));
  }
  return result;
}

function safeFilename(value) {
  return (value || '英语词汇挖空练习').replace(/[\\/:*?"<>|]/g, '-').trim();
}

export async function createExercisesDocxBlob(exercises, options) {
  const columnCount = normalizeColumnCount(options.columnCount);
  const children = makePages(exercises, options, false);
  if (options.includeAnswers && exercises.length) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...makePages(exercises, options, true));
  }

  const wordDocument = new Document({
    creator: '拾词 · 英语挖空练习生成器',
    title: options.title,
    description: `${columnCount} 列 A4 竖版英语词汇挖空练习`,
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
