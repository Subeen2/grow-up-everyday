import { validateExplainRequest } from './validate';
import { jaRequest, enRequest, conversation } from './testFixtures';

describe('validateExplainRequest', () => {
  it('accepts valid ja and en requests', () => {
    expect(validateExplainRequest(jaRequest)).toEqual(jaRequest);
    expect(validateExplainRequest(enRequest)).toEqual(enRequest);
  });

  it('rejects non-objects and unknown languages', () => {
    expect(validateExplainRequest(null)).toBeNull();
    expect(validateExplainRequest('hi')).toBeNull();
    expect(validateExplainRequest({ ...jaRequest, language: 'fr' })).toBeNull();
  });

  it('rejects a profile that does not match the language', () => {
    expect(validateExplainRequest({ ...jaRequest, profile: enRequest.profile })).toBeNull();
  });

  it('rejects a memo over 100 characters', () => {
    expect(validateExplainRequest({ ...jaRequest, profile: { ...jaRequest.profile, memo: 'a'.repeat(101) } })).toBeNull();
  });

  it('rejects missing or oversized entry fields', () => {
    const { reading: _omit, ...withoutReading } = jaRequest.entry as Record<string, string>;
    expect(validateExplainRequest({ ...jaRequest, entry: withoutReading })).toBeNull();
    expect(validateExplainRequest({ ...enRequest, entry: { ...enRequest.entry, exampleEn: 'a'.repeat(201) } })).toBeNull();
  });

  it('rejects more than 5 related words', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ word: `w${i}`, meaningKo: 'm' }));
    expect(validateExplainRequest({ ...jaRequest, relatedWords: six })).toBeNull();
  });

  it('accepts up to 5 follow-up questions and rejects the 6th', () => {
    expect(validateExplainRequest({ ...jaRequest, messages: conversation(5) })).not.toBeNull();
    expect(validateExplainRequest({ ...jaRequest, messages: conversation(6) })).toBeNull();
  });

  it('rejects conversations that do not start with assistant or do not end with user', () => {
    expect(validateExplainRequest({ ...jaRequest, messages: [{ role: 'user', content: '질문' }] })).toBeNull();
    expect(validateExplainRequest({ ...jaRequest, messages: [{ role: 'assistant', content: '답변' }] })).toBeNull();
  });

  it('rejects a question over 200 characters or a blank message', () => {
    const long = [{ role: 'assistant', content: '답변' }, { role: 'user', content: 'a'.repeat(201) }];
    const blank = [{ role: 'assistant', content: '답변' }, { role: 'user', content: '   ' }];
    expect(validateExplainRequest({ ...jaRequest, messages: long })).toBeNull();
    expect(validateExplainRequest({ ...jaRequest, messages: blank })).toBeNull();
  });
});
