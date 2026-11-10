import { validateExamPhoto } from "./model.mjs";
export async function prepareExamPhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("请选择JPG、PNG或WebP照片，HEIC需先转换");
  if (file.size > 20 * 1024 * 1024) throw Error("原始照片不能超过20MB");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight)
      throw Error("无法读取照片");
    const canvas = document.createElement("canvas"),
      context = canvas.getContext("2d");
    if (!context) throw Error("浏览器无法处理图片");
    let result = "";
    for (const [edge, quality] of [
      [2400, 0.9],
      [2200, 0.85],
      [1800, 0.82],
      [1600, 0.78],
    ]) {
      const ratio = Math.min(
        1,
        edge / Math.max(image.naturalWidth, image.naturalHeight),
      );
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      result = canvas.toDataURL("image/jpeg", quality);
      if (result.length <= 2800000) return validateExamPhoto(result);
    }
    throw Error("图片仍过大，请只拍清晰的答题区域");
  } finally {
    URL.revokeObjectURL(url);
  }
}
