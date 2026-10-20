const MAX_SLUG_LENGTH = 48;

/** URL-friendly identifier: "Dar Él Bacha & Spa" becomes "dar-el-bacha-spa". */
export function slugify(value: string): string {
  return (
    value
      .normalize('NFKD')
      // Drops combining diacritics (Unicode category M) left by NFKD: "é" becomes "e".
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_SLUG_LENGTH)
      .replace(/-+$/, '')
  );
}
