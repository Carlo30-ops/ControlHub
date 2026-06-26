export async function execute(api:any,inputPath:string,outputDir:string,params:any){
  // Assuming merge uses same api method (adjust if different)
  return await api.merge({input:inputPath,output:outputDir});
}
