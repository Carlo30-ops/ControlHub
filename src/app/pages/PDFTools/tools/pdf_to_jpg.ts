export async function execute(api:any,inputPath:string,outputDir:string,params:any){
  const {dpi}=params;
  return await api.pdfToJpg({input:inputPath,output_dir:outputDir,dpi:parseInt(dpi)});
}
