export async function execute(api:any,inputPath:string,outputDir:string,params:any){
  const {wmText,wmOpacity,wmAngle}=params;
  return await api.watermark({input:inputPath,output:outputDir,text:wmText,opacity:wmOpacity[0],angle:parseInt(wmAngle)});
}
