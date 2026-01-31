/**
 * 公共静态资源 URL（兼容 GitHub Pages 等子路径部署）
 * Vite 构建时会注入 import.meta.env.BASE_URL（如 '/' 或 '/the3meetup/'）
 */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL;
  const p = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${p}`;
}
