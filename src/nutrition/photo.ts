import { validatePhoto } from './model.mjs';
export async function preparePhoto(file:File):Promise<string> {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('请选择 JPG、PNG 或 WebP 照片；HEIC 请先转换格式');
  if(file.size>10*1024*1024)throw new Error('照片不能超过10 MB');
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();image.src=url;await image.decode();
    if(!image.naturalWidth||!image.naturalHeight)throw new Error('无法读取这张照片');
    const scale=Math.min(1,960/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const context=canvas.getContext('2d');if(!context)throw new Error('浏览器无法处理照片');
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    let result=canvas.toDataURL('image/jpeg',.78);
    if(result.length>500000)result=canvas.toDataURL('image/jpeg',.55);
    return validatePhoto(result) as string;
  } catch(error) {
    throw error instanceof Error&&error.message.startsWith('饮食照片')?error:new Error('无法处理这张照片，请换用 JPG、PNG 或较小的图片');
  } finally {URL.revokeObjectURL(url);}
}
