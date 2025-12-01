import { PublicClientApplication } from "@azure/msal-browser";
import { Client } from "@microsoft/microsoft-graph-client";
import { msalConfig, loginRequest, sharePointSiteUrl } from "./authConfig";

export class SharePointService {
    private msalInstance: PublicClientApplication;
    private graphClient: Client | null = null;
    private siteId: string | null = null;

    constructor() {
        this.msalInstance = new PublicClientApplication(msalConfig);
        this.msalInstance.initialize();
    }

    public async login(): Promise<any> {
        try {
            const response = await this.msalInstance.loginPopup(loginRequest);
            this.initializeGraphClient(response.account);
            return response.account;
        } catch (error) {
            console.error("Erro no login Microsoft:", error);
            throw error;
        }
    }

    public async logout() {
        await this.msalInstance.logoutPopup();
    }

    public getActiveAccount() {
        return this.msalInstance.getActiveAccount();
    }

    private initializeGraphClient(account: any) {
        if (!account) return;
        
        this.msalInstance.setActiveAccount(account);

        this.graphClient = Client.init({
            authProvider: async (done) => {
                try {
                    const response = await this.msalInstance.acquireTokenSilent({
                        ...loginRequest,
                        account: account
                    });
                    done(null, response.accessToken);
                } catch (error) {
                    done(error, null);
                }
            }
        });
    }

    // Resolve o Site ID a partir da URL (executado uma vez)
    private async getSiteId(): Promise<string> {
        if (this.siteId) return this.siteId;
        if (!this.graphClient) throw new Error("Não autenticado no Microsoft Graph");

        try {
            const hostname = new URL(sharePointSiteUrl).hostname;
            const path = new URL(sharePointSiteUrl).pathname;
            // Graph API format: /sites/{hostname}:{server-relative-path}
            const response = await this.graphClient.api(`/sites/${hostname}:${path}`).get();
            this.siteId = response.id;
            return response.id;
        } catch (error) {
            console.error("Erro ao obter Site ID do SharePoint:", error);
            throw error;
        }
    }

    // Genérico: Ler itens de uma lista SharePoint
    public async getListItems(listName: string): Promise<any[]> {
        if (!this.graphClient) return [];
        try {
            const siteId = await this.getSiteId();
            // Assume que a lista tem uma coluna 'JsonData' onde guardamos o objeto completo
            const response = await this.graphClient.api(`/sites/${siteId}/lists/${listName}/items`).expand('fields').get();
            
            return response.value.map((item: any) => {
                try {
                    // Tenta fazer parse do JSON armazenado na coluna customizada
                    return item.fields.JsonData ? JSON.parse(item.fields.JsonData) : null;
                } catch (e) {
                    return null;
                }
            }).filter(Boolean);
        } catch (error) {
            console.warn(`Lista '${listName}' não encontrada ou erro de permissão.`, error);
            return [];
        }
    }

    // Genérico: Salvar item (Upsert simulado)
    public async saveListItem(listName: string, id: string, data: any) {
        if (!this.graphClient) return;
        try {
            const siteId = await this.getSiteId();
            const jsonString = JSON.stringify(data);

            // 1. Procurar se já existe item com esse ID interno (precisamos guardar o ID do item em uma coluna indexada 'AppItemId' idealmente)
            // Para simplificar, vamos assumir Add Only ou teríamos que implementar busca. 
            // Nesta implementação simplificada, estamos apenas ADICIONANDO. 
            // Para atualizar, seria necessário buscar o ID do SharePoint primeiro.
            
            // Verifica se a lista existe, se não, tenta criar (complexo via Graph).
            // Assumimos que as listas 'Atividades', 'Usuarios', 'Lotes' já existem.

            // Estratégia de Update Simplificada: Busca todos, acha o match no JSON, pega o ID do SharePoint e atualiza.
            const items = await this.graphClient.api(`/sites/${siteId}/lists/${listName}/items`).expand('fields').get();
            const existingItem = items.value.find((i: any) => {
                const parsed = i.fields.JsonData ? JSON.parse(i.fields.JsonData) : {};
                return parsed.id === id || parsed.username === id; // id para atividades, username para users
            });

            if (existingItem) {
                // Update
                await this.graphClient.api(`/sites/${siteId}/lists/${listName}/items/${existingItem.id}/fields`).update({
                    JsonData: jsonString
                });
            } else {
                // Create
                await this.graphClient.api(`/sites/${siteId}/lists/${listName}/items`).post({
                    fields: {
                        Title: id, // Usa o ID como titulo para referência
                        JsonData: jsonString
                    }
                });
            }

        } catch (error) {
            console.error(`Erro ao salvar em ${listName}:`, error);
            throw error;
        }
    }

    // Deletar Item
    public async deleteListItem(listName: string, id: string) {
        if (!this.graphClient) return;
        try {
            const siteId = await this.getSiteId();
            const items = await this.graphClient.api(`/sites/${siteId}/lists/${listName}/items`).expand('fields').get();
            const existingItem = items.value.find((i: any) => {
                const parsed = i.fields.JsonData ? JSON.parse(i.fields.JsonData) : {};
                return parsed.id === id || parsed.username === id;
            });

            if (existingItem) {
                await this.graphClient.api(`/sites/${siteId}/lists/${listName}/items/${existingItem.id}`).delete();
            }
        } catch (error) {
            console.error(`Erro ao deletar de ${listName}:`, error);
        }
    }

    // Upload de Arquivo para Biblioteca de Documentos
    public async uploadFile(file: File, folderPath: string): Promise<string | null> {
        if (!this.graphClient) return null;
        try {
            const siteId = await this.getSiteId();
            // Drive padrão (Documentos)
            const drive = await this.graphClient.api(`/sites/${siteId}/drive`).get();
            const driveId = drive.id;

            const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const path = `/${folderPath}/${fileName}`;

            // Upload Content
            const uploadSession = await this.graphClient.api(`/sites/${siteId}/drives/${driveId}/root:${path}:/createUploadSession`).post({
                item: {
                    "@microsoft.graph.conflictBehavior": "rename",
                    name: fileName
                }
            });

            // Implementação simplificada de upload (para arquivos pequenos < 4MB direto é mais fácil, mas session é melhor)
            // Vamos usar PUT direto para arquivos pequenos para simplificar o código
            if (file.size < 4 * 1024 * 1024) {
                const putResponse = await this.graphClient.api(`/sites/${siteId}/drives/${driveId}/root:${path}:/content`).put(file);
                return putResponse.webUrl; // Link direto para o SharePoint
            } else {
                console.warn("Arquivo muito grande para upload simplificado.");
                return null;
            }

        } catch (error) {
            console.error("Erro no upload SharePoint:", error);
            return null;
        }
    }
}

export const spService = new SharePointService();
