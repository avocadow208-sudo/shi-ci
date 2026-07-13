import { describe, expect, it } from 'vitest';
import { exercisePrompt, makeExercises, parseVocabularyText } from './vocab';

describe('parseVocabularyText', () => {
  it('parses the scanned textbook line style', () => {
    const text = `
curious /'kjuəriəs/ adj. 好奇的；求知欲强的
volunteer /,vɒlən'tɪə(r)/ n. 志愿者
clean up 打扫（或清除）干净
schedule /'ʃedju:l/ n. 工作计划；日程安排
Unit 2
113
`;
    expect(parseVocabularyText(text)).toEqual([
      expect.objectContaining({ english: 'curious', chinese: '好奇的；求知欲强的' }),
      expect.objectContaining({ english: 'volunteer', chinese: '志愿者' }),
      expect.objectContaining({ english: 'clean up', chinese: '打扫（或清除）干净' }),
      expect.objectContaining({ english: 'schedule', chinese: '工作计划；日程安排' }),
    ]);
  });

  it('deduplicates repeated entries', () => {
    const items = parseVocabularyText('adult /ædʌlt/ n. 成年人\nadult /ædʌlt/ n. 成年人');
    expect(items).toHaveLength(1);
  });
});

describe('makeExercises', () => {
  const entries = Array.from({ length: 10 }, (_, index) => ({ id: String(index), english: `word${index}`, chinese: `词${index}` }));

  it('uses an exact requested blank ratio', () => {
    const result = makeExercises(entries, 60, 42);
    expect(result.filter((item) => item.blank === 'chinese')).toHaveLength(6);
    expect(exercisePrompt(result[0])).toContain('（');
  });

  it('is repeatable for the same seed', () => {
    expect(makeExercises(entries, 50, 7)).toEqual(makeExercises(entries, 50, 7));
  });
});

