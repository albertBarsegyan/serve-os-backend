export const stringToCommaSeparated = (input: string): string => {
  let result = '';
  let prevDash = false;

  for (const element of input) {
    const char = element.toLowerCase();

    const isAlphaNum = (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9');

    if (isAlphaNum) {
      result += char;
      prevDash = false;
    } else if ((char === ' ' || char === '-' || char === '_') && !prevDash) {
      result += '-';
      prevDash = true;
    }
  }

  return result.replaceAll(/^-|-$/g, '');
};
