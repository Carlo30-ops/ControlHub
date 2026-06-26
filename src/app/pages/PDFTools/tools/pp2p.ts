export async function execute(api:any,inputPath:string,outputDir:string,params:any){
  return await api.pptToPdf({input:inputPath,output:outputDir});
}
