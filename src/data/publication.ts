export const types = ['news','judgment','legislation','procedure','research','education','institution'] as const;
export type PublicationType=(typeof types)[number];
export const publicationTypes:Record<PublicationType,{section:string;label:string}> = {
 news:{section:'news',label:'Legal news'},
 judgment:{section:'judgments',label:'Case analysis'},
 legislation:{section:'bare-acts',label:'Legislation'},
 procedure:{section:'procedures',label:'Procedural guide'},
 research:{section:'research',label:'Research & analysis'},
 education:{section:'education',label:'Legal education'},
 institution:{section:'institutions',label:'Legal institutions'},
};
export const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
