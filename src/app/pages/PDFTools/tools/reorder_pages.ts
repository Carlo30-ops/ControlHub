export async function execute(api:any,inputPath:string,outputDir:string,params:any){
  const {pageOrder}=params;
  return await api.reorderPages({input:inputPath,output:outputDir,order:pageOrder});
}
