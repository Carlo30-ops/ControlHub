export async function execute(api:any,inputPath:string,outputDir:string,params:any){
  const {wmImage,wmOpacity}=params;
  return await api.watermarkImage({input:inputPath,output:outputDir,image:wmImage?.path,opacity:wmOpacity[0]});
}
