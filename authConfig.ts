// Configuração do Microsoft Azure Active Directory (MSAL)
// Você PRECISA preencher o clientId e authority com os dados do seu Portal Azure.

export const msalConfig = {
    auth: {
        // ID do Aplicativo (Client ID) registrado no Azure AD
        clientId: "INSIRA_SEU_CLIENT_ID_AQUI", 
        
        // URL da Autoridade (Substitua 'common' pelo seu Tenant ID se for single-tenant)
        // Exemplo: "https://login.microsoftonline.com/seu-tenant-id-aqui"
        authority: "https://login.microsoftonline.com/common",
        
        // URL de redirecionamento (deve corresponder ao registrado no Azure)
        redirectUri: window.location.origin,
    },
    cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: false,
    },
};

// Escopos de permissão necessários para ler/escrever no SharePoint
export const loginRequest = {
    scopes: ["User.Read", "Sites.ReadWrite.All", "Files.ReadWrite.All"]
};

// URL do Site SharePoint onde as listas serão criadas
export const sharePointSiteUrl = "https://mosaicco.sharepoint.com/sites/RelatriosCLP";
