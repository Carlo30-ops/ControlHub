export async function execute(api:any,inputPath:string,outputDir:string,params:any){
  const {cropRect}=params;
  return await api.crop({input:inputPath,output:outputDir,rect:[cropRect.x0,cropRect.y0,cropRect.x1,cropRect.y1]});
}
