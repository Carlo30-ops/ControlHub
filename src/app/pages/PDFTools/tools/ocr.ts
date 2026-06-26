export async function execute(api:any,inputPath:string,outputDir:string,params:any){
  const {ocrLang}=params;
  return await api.ocr({input:inputPath,output:outputDir,lang:ocrLang});
}
