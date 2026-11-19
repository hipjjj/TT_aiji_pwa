export const articleTextLimit=100000;
export const pdfByteLimit=12*1024*1024;
export function articleURL(value){
  if(typeof value!=='string'||!value.trim()||value.length>2048)throw Error('请填写有效的公开网页地址');
  let url;try{const input=value.trim();url=new URL(/^[a-z][a-z\d+.-]*:/i.test(input)?input:`https://${input}`);}catch{throw Error('网页地址格式不正确');}
  const host=url.hostname.toLowerCase().replace(/\.$/,'');url.hostname=host;
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port||!host.includes('.')||host.startsWith('[')||/^[\d.]+$/.test(host)||/(^|\.)(localhost|local|internal|lan|test|invalid|onion)$/.test(host)||/\.(nip\.io|sslip\.io)$/.test(host))throw Error('请使用不含账号密码的公开 HTTP 或 HTTPS 网页地址');
  url.hash='';return url.href;
}
export function articleText(value){
  if(typeof value!=='string')throw Error('没有读到文章正文');
  const content=value.replace(/\r\n?/g,'\n').replace(/[\t\u00a0 ]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  if(!content)throw Error('没有读到文章正文');
  if(content.length>articleTextLimit)throw Error('正文超过10万字符，请分成几篇导入');
  return content;
}
