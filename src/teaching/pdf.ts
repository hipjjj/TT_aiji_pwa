import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerURL from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { pdfPageText } from '../study/pdf-text.mjs';
import type { Material } from './types';
GlobalWorkerOptions.workerSrc = workerURL;
export async function readTeachingPDF(file: File, signal: AbortSignal, progress: (n: number, total: number) => void): Promise<Material['pages']> {
    if (file.size > 20 * 1024 * 1024)
        throw Error('请选择20MB以内的PDF');
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes('%PDF-'))
        throw Error('这不是有效的PDF文件');
    if (signal.aborted)
        throw new DOMException('已取消', 'AbortError');
    const task = getDocument({ data: bytes, useSystemFonts: true }), cancel = () => { void task.destroy(); };
    signal.addEventListener('abort', cancel, { once: true });
    try {
        const doc = await task.promise;
        if (doc.numPages > 300)
            throw Error('请选择300页以内的教材，较长资料请分册导入');
        const pages: Material['pages'] = [];
        let size = 0;
        for (let n = 1; n <= doc.numPages; n++) {
            if (signal.aborted)
                throw new DOMException('已取消', 'AbortError');
            progress(n, doc.numPages);
            const page = await doc.getPage(n);
            try {
                const content = await page.getTextContent(), text = pdfPageText(content.items);
                size += text.length;
                if (size > 1500000)
                    throw Error('教材文字过多，请分册导入');
                const bold = content.items.filter((x): x is Extract<typeof x, {
                    str: string;
                }> => 'str' in x).filter(x => /bold|black|heavy/i.test(x.fontName + ' ' + (content.styles[x.fontName]?.fontFamily || ''))).map(x => x.str).filter(Boolean);
                pages.push({ number: n, text, bold });
            }
            finally {
                page.cleanup();
            }
        }
        if (pages.filter(p => p.text.trim()).length < Math.min(3, pages.length))
            throw Error('这份PDF没有足够的可读文字，请先OCR识别为文字版PDF');
        return pages;
    }
    catch (e) {
        if (signal.aborted)
            throw new DOMException('已取消', 'AbortError');
        if (e instanceof Error && e.name === 'PasswordException')
            throw Error('PDF有密码保护，请先解锁');
        throw e;
    }
    finally {
        signal.removeEventListener('abort', cancel);
        await task.destroy();
    }
}
