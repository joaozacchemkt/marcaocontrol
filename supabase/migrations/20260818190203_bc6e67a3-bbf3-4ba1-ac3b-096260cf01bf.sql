DO $$
DECLARE
  uid uuid;
  p record;
  rel record;
  a uuid; b uuid;
BEGIN
  SELECT id INTO uid FROM auth.users ORDER BY created_at LIMIT 1;
  IF uid IS NULL THEN RAISE NOTICE 'sem usuario'; RETURN; END IF;

  FOR p IN
    SELECT * FROM (VALUES
      ('Negócios Imobiliários — Perfil Marcus','perfil_imobiliario','Legalização de imóveis e leilões','Posicionar o perfil como referência em legalização e leilões'),
      ('JPA — Reformas','reformas','Reformas e obras','Estruturar a operação comercial e de execução'),
      ('Faculdade — Direito','faculdade','Estudos','Concluir a graduação com bom desempenho'),
      ('Preparação para OAB','oab','Estudos','Aprovação no Exame de Ordem'),
      ('Papucaia — Obra','obra','Obra','Executar a obra dentro do prazo e do orçamento'),
      ('Pontual Digital','produto_digital','Produto digital','Estruturar o produto digital'),
      ('Consultoria Pontual','consultoria','Consultoria','Gerir as frentes da consultoria'),
      ('Ulhoa Canto','generico','Trabalho','Acompanhar demandas'),
      ('Projeto SPKR','generico','Novo negócio','Estruturar o projeto'),
      ('Assuntos Domésticos','domestico','Pessoal','Manter a casa organizada'),
      ('Financeiro Pessoal','financeiro_pessoal','Pessoal','Controlar receitas, despesas e metas'),
      ('Papucaia — Casa / Leilão / Investimento','investimento_imovel','Investimento','Legalizar, valorizar e vender com ROI positivo')
    ) AS t(name, ptype, category, objective)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.projects WHERE user_id = uid AND name = p.name) THEN
      INSERT INTO public.projects (user_id, name, type, category, objective, status)
      VALUES (uid, p.name, p.ptype::project_type, p.category, p.objective, 'em_andamento');
    END IF;
  END LOOP;

  -- SPKR: mostrar todas as abas disponíveis do template genérico
  UPDATE public.projects
     SET tab_config = '{"order": ["overview","board","objetivos","tasks","calendar","notes","files","team","finance","timeline"], "hidden": []}'::jsonb
   WHERE user_id = uid AND name = 'Projeto SPKR' AND (tab_config IS NULL OR tab_config = '{}'::jsonb);

  FOR rel IN
    SELECT * FROM (VALUES
      ('Negócios Imobiliários — Perfil Marcus','JPA — Reformas','estrategico'),
      ('Negócios Imobiliários — Perfil Marcus','Papucaia — Obra','estrategico'),
      ('Negócios Imobiliários — Perfil Marcus','Papucaia — Casa / Leilão / Investimento','estrategico'),
      ('Faculdade — Direito','Preparação para OAB','relacionado'),
      ('Consultoria Pontual','Pontual Digital','operacional'),
      ('Papucaia — Obra','Papucaia — Casa / Leilão / Investimento','subprojeto'),
      ('Assuntos Domésticos','Financeiro Pessoal','relacionado')
    ) AS t(src, dst, rtype)
  LOOP
    SELECT id INTO a FROM public.projects WHERE user_id = uid AND name = rel.src LIMIT 1;
    SELECT id INTO b FROM public.projects WHERE user_id = uid AND name = rel.dst LIMIT 1;
    IF a IS NOT NULL AND b IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.project_relations
          WHERE user_id = uid
            AND ((project_id = a AND related_project_id = b) OR (project_id = b AND related_project_id = a))
       ) THEN
      INSERT INTO public.project_relations (user_id, project_id, related_project_id, relation_type)
      VALUES (uid, a, b, rel.rtype);
    END IF;
  END LOOP;
END $$;