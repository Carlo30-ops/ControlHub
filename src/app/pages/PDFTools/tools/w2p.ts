export async function execute(api:any,inputPath:string,outputDir:string,params:any){
  return await api.wordToPdf({input:inputPath,output:outputDir});
}
