export async function execute(api:any,inputPath:string,outputDir:string,params:any){
  const {rotateAngle,rotatePages}=params;
  return await api.rotate({input:inputPath,output:outputDir,angle:parseInt(rotateAngle),pages:rotatePages});
}
