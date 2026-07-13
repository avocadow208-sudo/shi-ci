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

const PAGE_WIDTH = 16838;
const PAGE_HEIGHT = 11906;
const COLORS = {
  ink: '243235',
  muted: '667477',
  rule: 'D7E0DE',
  accent: '0F766E',
  wash: 'F1F7F5',
};

export const DENSITY = {
  comfortable: { label: '舒展', perPage: 60, font: 18, spacing: 150 },
  compact: { label: '紧凑', perPage: 80, font: 16, spacing: 115 },
  maximum: { label: '极致', perPage: 100, font: 14, spacing: 85 },
};

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

function makeGrid(items, density, answerMode = false, numberOffset = 0) {
  const rows = [];
  const rowsPerPage = Math.ceil(items.length / 5);
  for (let rowIndex = 0; rowIndex < rowsPerPage; rowIndex += 1) {
    const cells = [];
    for (let col = 0; col < 5; col += 1) {
      const itemIndex = rowIndex * 5 + col;
      const item = items[itemIndex];
      const text = item ? (answerMode ? exerciseAnswer(item) : exercisePrompt(item)) : '';
      cells.push(new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.TOP,
        margins: { top: 35, bottom: 35, left: 55, right: 55 },
        shading: answerMode && rowIndex % 2 === 0 ? { fill: COLORS.wash, type: ShadingType.CLEAR } : undefined,
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.SINGLE, color: COLORS.rule, size: 3 },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.SINGLE, color: COLORS.rule, size: 3 },
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
  const result = [];
  for (let start = 0; start < exercises.length; start += density.perPage) {
    if (start > 0) result.push(new Paragraph({ children: [new PageBreak()] }));
    const pageItems = exercises.slice(start, start + density.perPage);
    const pageNumber = Math.floor(start / density.perPage) + 1;
    result.push(...makeHeader(
      answerMode ? `${options.title || '英语词汇挖空练习'} · 答案` : options.title,
      `${answerMode ? '答案页' : '练习页'} ${pageNumber}　·　共 ${exercises.length} 题　·　五列排版`,
    ));
    result.push(makeGrid(pageItems, density, answerMode, start));
  }
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
    description: '五列 A4 英语词汇挖空练习',
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_WIDTH, height: PAGE_HEIGHT, orientation: 'landscape' },
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
