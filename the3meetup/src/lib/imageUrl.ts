/**
 * 获取图片 URL
 * @param imageName 图片文件名
 * @returns 图片 URL
 */
export function getImageUrl(imageName: string): string {
  if (!imageName) {
    return '';
  }
  
  // 如果已经是完整的 URL，直接返回
  if (imageName.startsWith('http://') || imageName.startsWith('https://')) {
    return imageName;
  }
  
  // 使用 OSS URL（与后端 getOSSURL 函数保持一致）
  const bucket = 'the3-meetup-web';
  const region = 'cn-hongkong';
  
  // 如果 imageName 已经包含 images/ 前缀，直接使用；否则添加
  const fileName = imageName.startsWith('images/') ? imageName : `images/${imageName}`;
  
  return `https://${bucket}.oss-${region}.aliyuncs.com/${fileName}`;
}

