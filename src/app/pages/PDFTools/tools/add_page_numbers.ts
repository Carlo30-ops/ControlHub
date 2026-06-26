export async function execute(api:any,inputPath:string,outputDir:string,params:any){
  const {pageNumberPos,pageNumberStart}=params;
  return await api.addPageNumbers({input:inputPath,output:outputDir,position:pageNumberPos,start:parseInt(pageNumberStart)});
}
