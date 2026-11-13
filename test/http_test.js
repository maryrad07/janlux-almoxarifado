const app = require('../src/server');

const PORT = 3001;

const server = app.listen(PORT, async () => {
  console.log(`[HTTP TEST] Servidor de teste iniciado na porta ${PORT}`);

  try {
    const baseUrl = `http://localhost:${PORT}`;

    // Helper for requests
    async function request(url, options = {}) {
      const res = await fetch(`${baseUrl}${url}`, {
        redirect: 'manual',
        ...options
      });
      return res;
    }

    // 1. GET /login
    console.log('1. Testando GET /login...');
    const resLogin = await request('/login');
    if (resLogin.status !== 200) throw new Error(`GET /login retornou ${resLogin.status}`);
    const textLogin = await resLogin.text();
    if (!textLogin.includes('JANLUX ELÉTRICOS')) throw new Error('Tela de login não contém título');
    console.log('   ✓ /login OK (200)');

    // 2. POST /login com admin
    console.log('2. Testando POST /login (autenticação)...');
    const resAuth = await request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'login=admin&senha=admin123'
    });
    const cookie = resAuth.headers.get('set-cookie');
    if (!cookie) throw new Error('Não recebeu cookie de sessão');
    const sessionCookie = cookie.split(';')[0];
    console.log('   ✓ Login autenticado com sucesso (cookie recebido)');

    const authHeaders = { 'Cookie': sessionCookie };

    // 3. GET /dashboard
    console.log('3. Testando GET /dashboard...');
    const resDash = await request('/dashboard', { headers: authHeaders });
    if (resDash.status !== 200) throw new Error(`Dashboard retornou ${resDash.status}`);
    const dashText = await resDash.text();
    if (!dashText.includes('Painel de Controle Operacional')) throw new Error('Dashboard sem título');
    console.log('   ✓ /dashboard OK (200)');

    // 4. GET /expedicoes
    console.log('4. Testando GET /expedicoes...');
    const resExp = await request('/expedicoes', { headers: authHeaders });
    if (resExp.status !== 200) throw new Error(`Expedicoes retornou ${resExp.status}`);
    console.log('   ✓ /expedicoes OK (200)');

    // 5. GET /almoxarifado
    console.log('5. Testando GET /almoxarifado...');
    const resAlm = await request('/almoxarifado', { headers: authHeaders });
    if (resAlm.status !== 200) throw new Error(`Almoxarifado retornou ${resAlm.status}`);
    console.log('   ✓ /almoxarifado OK (200)');

    // 6. GET /coletas
    console.log('6. Testando GET /coletas...');
    const resCol = await request('/coletas', { headers: authHeaders });
    if (resCol.status !== 200) throw new Error(`Coletas retornou ${resCol.status}`);
    console.log('   ✓ /coletas OK (200)');

    // 7. GET /cadastros/clientes
    console.log('7. Testando GET /cadastros/clientes...');
    const resCli = await request('/cadastros/clientes', { headers: authHeaders });
    if (resCli.status !== 200) throw new Error(`Clientes retornou ${resCli.status}`);
    console.log('   ✓ /cadastros/clientes OK (200)');

    // 8. GET /cadastros/produtos
    console.log('8. Testando GET /cadastros/produtos...');
    const resProd = await request('/cadastros/produtos', { headers: authHeaders });
    if (resProd.status !== 200) throw new Error(`Produtos retornou ${resProd.status}`);
    console.log('   ✓ /cadastros/produtos OK (200)');

    // 9. GET /relatorios
    console.log('9. Testando GET /relatorios...');
    const resRel = await request('/relatorios', { headers: authHeaders });
    if (resRel.status !== 200) throw new Error(`Relatorios retornou ${resRel.status}`);
    console.log('   ✓ /relatorios OK (200)');

    // 10. GET /relatorios/executar?tipo=1
    console.log('10. Testando Execução do Relatório 1 (Expedições por Período)...');
    const resRel1 = await request('/relatorios/executar?tipo=1', { headers: authHeaders });
    if (resRel1.status !== 200) throw new Error(`Relatorio 1 retornou ${resRel1.status}`);
    console.log('   ✓ /relatorios/executar?tipo=1 OK (200)');

    // 11. Teste de concorrência / acesso simultâneo (20 requisições paralelas)
    console.log('11. Testando Acesso Simultâneo / Concorrente (20 requisições simultâneas)...');
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(request('/expedicoes', { headers: authHeaders }));
    }
    const results = await Promise.all(promises);
    for (const r of results) {
      if (r.status !== 200) throw new Error(`Requisição simultânea falhou com status ${r.status}`);
    }
    console.log('   ✓ 20 requisições simultâneas responderam com código 200 OK');

    console.log('\n=======================================================');
    console.log('  TESTES HTTP E DE CONCORRÊNCIA FINALIZADOS COM SUCESSO!');
    console.log('=======================================================');
  } catch (err) {
    console.error('Falha nos testes HTTP:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    process.exit(process.exitCode || 0);
  }
});
