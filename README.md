# SISTEMA DE CONTROLE DE ALMOXARIFADO, EMBALAGENS E EXPEDIÇÃO — JANLUX ELÉTRICOS LTDA.

Sistema informatizado para controle integrado de almoxarifado, embalagens, preparação de mercadorias, expedição de pedidos e registro de retiradas físicas por transportadoras.

Desenvolvido para operar em **rede local com múltiplos computadores acessando simultaneamente**, sem necessidade de internet ou serviços em nuvem.

---

## 🚀 Como Iniciar o Sistema

### Método Rápido (Windows)
Dê um duplo clique no arquivo:
```
iniciar_sistema.bat
```

### Método via Linha de Comando
Abra o prompt de comando ou PowerShell na pasta do projeto e execute:
```bash
node src/server.js
```

O sistema exibirá:
```
=======================================================
  SISTEMA JANLUX — ALMOXARIFADO E EXPEDIÇÃO ATIVO
  Acesso Local:       http://localhost:3000
  Acesso em Rede:     http://[IP-DO-COMPUTADOR]:3000
=======================================================
```

---

## 🌐 Acesso por Vários Computadores Simultaneamente

Para que outros computadores da empresa acessem o sistema:
1. Descubra o IP do computador principal (servidor) executando `ipconfig` (ex: `192.168.1.100`).
2. Nos demais computadores, abra o navegador e acesse:
   ```
   http://192.168.1.100:3000
   ```
3. O banco de dados SQLite com WAL (Write-Ahead Logging) processa leituras e gravações concorrentes com segurança.

---

## 👥 Usuários e Perfis de Acesso

| Usuário | Senha | Perfil | Permissões |
|---------|-------|--------|------------|
| `admin` | `admin123` | **Administrador** | Acesso total, gerenciamento de usuários, auditoria, backups |
| `sandra` | `sandra123` | **Operacional** | Lançamento de NFs, conferência, coletas, movimentação de caixas |
| `ivan` | `ivan123` | **Operacional** | Lançamento de NFs, conferência, coletas, movimentação de caixas |
| `consulta` | `consulta123` | **Consulta** | Apenas visualização de registros e emissão de relatórios |

*Novos usuários podem ser criados em: Administração &rarr; Usuários e Permissões.*

---

## 📦 Estrutura dos Módulos

### 1. Painel de Controle (Dashboard)
- Indicadores em tempo real: expedições do dia, em preparação, prontas para coleta, coletas concluídas, total de volumes físicos do dia, comprovantes pendentes e alertas de embalagens com estoque baixo.
- Atalhos para as operações mais frequentes da rotina.

### 2. Almoxarifado e Controle de Embalagens
- Cadastro de embalagens com dimensões (C×L×A em cm), peso (g) e estoque mínimo.
- Registro de movimentações: Entradas, Saídas, Uso em Expedição, Ajustes de Inventário e Devoluções.
- Cálculo automático de saldo e alertas quando o estoque atinge o limite mínimo.

### 3. Preparação e Expedição de Mercadorias
- Controle do fluxo: *Aguardando preparação &rarr; Em preparação &rarr; Aguardando conferência &rarr; Pronta para coleta &rarr; Coleta agendada &rarr; Coletada/Expedida*.
- **Regra de Ouro:** Distinção absoluta entre produtos comercializados (itens da NF) e volumes físicos entregues (caixas/pacotes).
- Checklist de conferência com bloqueio em caso de divergência.

### 4. Coletas e Retirada de Mercadorias
- Registro da retirada física pelo transportador com data e horário efetivos.
- Associação de múltiplas notas fiscais a uma mesma coleta.
- **Geração Automática do Comprovante de Retirada em PDF formatado para papel A4** com cabeçalho oficial, discriminação das NFs, soma de volumes físicos, declaração legal de recebimento e espaços para assinatura.
- Controle de situação do comprovante (*Emitido, Assinado, Arquivado*).

### 5. Consultas e Relatórios
12 relatórios gerenciais com filtros por período e **exportação nativa para Excel (.xlsx)**:
1. Expedições realizadas por período
2. Notas fiscais expedidas por cliente
3. Coletas realizadas por transportadora
4. Volumes retirados por dia, semana ou mês
5. Histórico de coleta por nota fiscal
6. Coletas com comprovantes pendentes
7. Comprovantes assinados e arquivados
8. Movimentações de embalagens
9. Saldo atual de embalagens
10. Consumo de embalagens por período
11. Ocorrências e divergências registradas
12. Tempo de operação (Lead Time)

---

## 🔒 Segurança, Backup e Recuperação

### Como Criar Backup
- No sistema, acesse: **Administração &rarr; Backup e Recuperação** e clique em **Criar Backup Imediato**.
- Ou execute via terminal:
  ```bash
  npm run backup
  ```
- O arquivo é salvo em `backups/janlux-backup-[DATA].db`.

### Como Restaurar Backup
- Na tela de Backup, clique no botão **Restaurar Este** ao lado do backup desejado.
- Ou execute:
  ```bash
  node src/utils/backup.js restore [NOME_DO_ARQUIVO.db]
  ```

---

## 📊 Dados Históricos Importados

O sistema já vem populado com todos os dados da planilha original `Controle do Almoxarifado - 2026.xlsx`:
- **1.164** Expedições migradas com histórico
- **1.703** Itens de NFs
- **1.328** Volumes físicos individuais
- **453** Clientes cadastrados
- **198** Produtos do catálogo JANLUX
- **80** Transportadoras cadastradas
