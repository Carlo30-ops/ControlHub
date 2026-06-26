export async function execute(api:any,inputPath:string,outputDir:string,params:any){
  // Assuming jpg_to_pdf uses same api method (adjust if different)
  return await api.jpgToPdf({input:inputPath,output:outputDir});
}
