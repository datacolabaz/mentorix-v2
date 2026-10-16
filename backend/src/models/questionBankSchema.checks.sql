-- Executed only by questionBankSchema.test.js inside an isolated, rolled-back schema.
CREATE FUNCTION pg_temp.qb_assert(ok BOOLEAN, label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Assertion failed: %', label; END IF;
END $$;
CREATE FUNCTION pg_temp.qb_expect_error(command TEXT, expected TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE command;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected THEN RETURN; END IF;
    RAISE EXCEPTION 'Expected SQLSTATE %, received %: %', expected, SQLSTATE, SQLERRM;
  END;
  RAISE EXCEPTION 'Expected SQLSTATE %, but command succeeded: %', expected, command;
END $$;

DO $$
DECLARE
  t1 UUID := '10000000-0000-4000-8000-000000000001';
  t2 UUID := '10000000-0000-4000-8000-000000000002';
  s1 UUID := '10000000-0000-4000-8000-000000000003';
  s2 UUID := '10000000-0000-4000-8000-000000000004';
  subject1 UUID := '20000000-0000-4000-8000-000000000001';
  subject2 UUID := '20000000-0000-4000-8000-000000000002';
  material1 UUID := '30000000-0000-4000-8000-000000000001';
  material2 UUID := '30000000-0000-4000-8000-000000000002';
  material3 UUID := '30000000-0000-4000-8000-000000000003';
  exam1 UUID := '40000000-0000-4000-8000-000000000001';
  exam2 UUID := '40000000-0000-4000-8000-000000000002';
  eq1 UUID := '50000000-0000-4000-8000-000000000001';
  eq2 UUID := '50000000-0000-4000-8000-000000000002';
  eq3 UUID := '50000000-0000-4000-8000-000000000003';
  eq4 UUID := '50000000-0000-4000-8000-000000000004';
  attempt1 UUID := '60000000-0000-4000-8000-000000000001';
  attempt2 UUID := '60000000-0000-4000-8000-000000000002';
  attempt3 UUID := '60000000-0000-4000-8000-000000000003';
  topic1 UUID := '70000000-0000-4000-8000-000000000001';
  topic2 UUID := '70000000-0000-4000-8000-000000000002';
  pdf1 UUID := '80000000-0000-4000-8000-000000000001';
  bq1 UUID := '90000000-0000-4000-8000-000000000001';
  bq2 UUID := '90000000-0000-4000-8000-000000000002';
  bq3 UUID := '90000000-0000-4000-8000-000000000003';
  bq4 UUID := '90000000-0000-4000-8000-000000000004';
  bank1 UUID := 'a0000000-0000-4000-8000-000000000001';
  bank2 UUID := 'a0000000-0000-4000-8000-000000000002';
  kind TEXT;
BEGIN
  INSERT INTO question_bank_topics (id,subject_id,created_by,name) VALUES (topic1,subject1,t1,'Algebra');
  INSERT INTO question_bank_topics (id,subject_id,created_by,parent_topic_id,name) VALUES (topic2,subject1,t1,topic1,'Equations');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE question_bank_topics SET parent_topic_id=%L WHERE id=%L',topic2,topic1),'23514');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE question_bank_topics SET parent_topic_id=id WHERE id=%L',topic2),'23514');
  PERFORM pg_temp.qb_expect_error(format(
    'INSERT INTO question_bank_topics(subject_id,created_by,parent_topic_id,name) VALUES(%L,%L,%L,''Cross-owner'')',
    subject2,t2,topic1),'23503');

  INSERT INTO source_pdfs(id,material_id,uploaded_by,subject_id) VALUES(pdf1,material1,t1,subject1);
  PERFORM pg_temp.qb_expect_error(format(
    'INSERT INTO source_pdfs(material_id,uploaded_by,subject_id) VALUES(%L,%L,%L)',material2,t1,subject1),'23514');
  PERFORM pg_temp.qb_expect_error(format(
    'INSERT INTO source_pdfs(material_id,uploaded_by,subject_id) VALUES(%L,%L,%L)',material3,t1,subject1),'23514');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE source_pdfs SET subject_id=%L WHERE id=%L',subject2,pdf1),'23503');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE course_materials SET file_type=''image/png'' WHERE id=%L',material1),'23514');
  PERFORM pg_temp.qb_expect_error(format('DELETE FROM course_materials WHERE id=%L',material1),'23503');

  INSERT INTO bank_questions(id,created_by,subject_id,topic_id,source_pdf_id,source_page,
    question_text,question_type,points,answer_key,status,explanation)
  VALUES(bq1,t1,subject1,topic2,pdf1,2,'Original choice','single_choice',2,'{"correct_option_ids":["A"]}','published','Original explanation'),
    (bq2,t1,subject1,topic2,NULL,NULL,'Explain','open_answer',3,'{}','published',NULL),
    (bq3,t1,subject1,NULL,NULL,NULL,'Attach work','file_upload',4,'{}','published',NULL),
    (bq4,t2,subject2,NULL,NULL,NULL,'Other teacher question','single_choice',5,'{"correct_option_ids":["B"]}','published',NULL);
  FOREACH kind IN ARRAY ARRAY['multiple_choice','true_false','short_answer','numeric','matching','ordering'] LOOP
    INSERT INTO bank_questions(created_by,subject_id,question_text,question_type,answer_key,status)
      VALUES(t1,subject1,kind,kind,'{"accepted":["test"]}','published');
  END LOOP;
  PERFORM pg_temp.qb_assert((SELECT count(DISTINCT question_type)=9 FROM bank_questions),'all nine types persist');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE bank_questions SET subject_id=%L WHERE id=%L',subject2,bq1),'23503');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE bank_questions SET source_page=0 WHERE id=%L',bq1),'23514');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE bank_questions SET source_page=1 WHERE id=%L',bq2),'23514');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE bank_questions SET source_pdf_id=%L WHERE id=%L',pdf1,bq4),'23503');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE bank_questions SET answer_key=''{}'' WHERE id=%L',bq1),'23514');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE bank_questions SET points=''NaN'' WHERE id=%L',bq1),'23514');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE bank_questions SET question_type=''unsupported'' WHERE id=%L',bq1),'23514');

  INSERT INTO question_options(question_id,option_text,is_correct,order_num) VALUES(bq1,'A',TRUE,1),(bq1,'B',FALSE,2);
  PERFORM pg_temp.qb_expect_error(format(
    'INSERT INTO question_options(question_id,option_text,order_num) VALUES(%L,''Duplicate'',1)',bq1),'23505');
  INSERT INTO question_banks(id,created_by,name) VALUES(bank1,t1,'Algebra collection'),(bank2,t2,'Other collection');
  INSERT INTO question_bank_items VALUES(bank1,bq1,t1,NOW());
  PERFORM pg_temp.qb_expect_error(format(
    'INSERT INTO question_bank_items(bank_id,question_id,created_by) VALUES(%L,%L,%L)',bank1,bq4,t1),'23503');
  PERFORM pg_temp.qb_expect_error(format(
    'INSERT INTO question_bank_items(bank_id,question_id,created_by) VALUES(%L,%L,%L)',bank2,bq1,t1),'23503');
  PERFORM pg_temp.qb_expect_error(format(
    'INSERT INTO exam_bank_settings(exam_id,created_by,subject_id) VALUES(%L,%L,%L)',exam1,t2,subject2),'23503');

  INSERT INTO exam_bank_settings(exam_id,created_by,subject_id,shuffle_questions,shuffle_options)
    VALUES(exam1,t1,subject1,TRUE,TRUE),(exam2,t2,subject2,FALSE,FALSE);
  INSERT INTO exam_bank_questions(exam_question_id,exam_id,created_by,bank_question_id,question_type,
    subject_id,topic_id,points,snapshot)
  SELECT eq.id,eq.exam_id,q.created_by,q.id,q.question_type,q.subject_id,q.topic_id,q.points,
    jsonb_build_object('question_type',q.question_type,'question_text',q.question_text,
      'answer_key',q.answer_key,'options','[]'::jsonb,'explanation',q.explanation)
  FROM (VALUES(eq1,bq1),(eq2,bq2),(eq3,bq3),(eq4,bq4)) AS mapping(eq_id,bq_id)
  JOIN exam_questions eq ON eq.id=mapping.eq_id JOIN bank_questions q ON q.id=mapping.bq_id;
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE exam_bank_questions SET snapshot=jsonb_set(snapshot,''{question_type}'',''null'') WHERE exam_question_id=%L',eq1),'23514');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE exam_bank_questions SET bank_question_id=%L WHERE exam_question_id=%L',bq4,eq1),'23503');

  INSERT INTO exam_attempt_details(attempt_id,exam_id,student_id,max_score,question_order,option_order)
    VALUES(attempt1,exam1,s1,9,ARRAY[eq3,eq1,eq2],jsonb_build_object(eq1::text,ARRAY['B','A']));
  INSERT INTO exam_attempt_details(attempt_id,exam_id,student_id,max_score,question_order)
    VALUES(attempt2,exam2,s2,5,ARRAY[eq4]);
  PERFORM pg_temp.qb_assert((SELECT question_order=ARRAY[eq3,eq1,eq2] FROM exam_attempt_details WHERE attempt_id=attempt1),'shuffle order is stable');
  PERFORM pg_temp.qb_expect_error(format(
    'INSERT INTO exam_attempt_details(attempt_id,exam_id,student_id,max_score,question_order) VALUES(%L,%L,%L,9,ARRAY[%L,%L,%L]::uuid[])',
    attempt3,exam1,s1,eq1,eq2,eq3),'23503');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE exam_attempt_details SET question_order=ARRAY[%L,%L,%L]::uuid[] WHERE attempt_id=%L',eq1,eq1,eq2,attempt1),'23514');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE exam_attempt_details SET question_order=ARRAY[%L,%L,%L]::uuid[] WHERE attempt_id=%L',eq1,eq2,eq4,attempt1),'23514');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE exam_attempt_details SET max_score=99 WHERE attempt_id=%L',attempt1),'23514');
  PERFORM pg_temp.qb_expect_error(format(
    'INSERT INTO exam_answers(attempt_id,question_id,exam_id) VALUES(%L,%L,%L)',attempt1,eq4,exam1),'23503');

  INSERT INTO exam_answers(attempt_id,question_id,exam_id,answer_data,status,is_correct,awarded_points)
    VALUES(attempt1,eq1,exam1,'"A"','auto_graded',TRUE,2);
  INSERT INTO exam_answers(attempt_id,question_id,exam_id,answer_data,status)
    VALUES(attempt1,eq2,exam1,'"Essay"','pending_review'),(attempt1,eq3,exam1,'[]','pending_review');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE exam_answers SET status=''auto_graded'',is_correct=TRUE,awarded_points=3 WHERE question_id=%L',eq2),'23514');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE exam_answers SET status=''auto_graded'',is_correct=TRUE,awarded_points=4 WHERE question_id=%L',eq3),'23514');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE exam_answers SET awarded_points=10 WHERE question_id=%L',eq1),'23514');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE exam_answers SET reviewed_by=%L,reviewed_at=NOW(),status=''reviewed'',awarded_points=1 WHERE question_id=%L',t2,eq2),'23514');
  UPDATE exam_answers SET reviewed_by=t1,reviewed_at=NOW(),status='reviewed',
    awarded_points=1.5,teacher_feedback='Partial credit' WHERE question_id=eq2;
  PERFORM pg_temp.qb_assert((SELECT awarded_points=1.5 AND teacher_feedback='Partial credit' FROM exam_answers WHERE question_id=eq2),'manual feedback and fractional points');

  INSERT INTO exam_answer_files(attempt_id,question_id,uploaded_by,file_name,content_type,byte_size,data)
    VALUES(attempt1,eq3,s1,'work.txt','text/plain',3,decode('616263','hex'));
  PERFORM pg_temp.qb_expect_error(format(
    'INSERT INTO exam_answer_files(attempt_id,question_id,uploaded_by,file_name,content_type,byte_size,data)
      VALUES(%L,%L,%L,''bad.txt'',''text/plain'',1,decode(''61'',''hex''))',attempt1,eq3,s2),'23514');
  PERFORM pg_temp.qb_expect_error(format(
    'INSERT INTO exam_answer_files(attempt_id,question_id,uploaded_by,file_name,content_type,byte_size,data)
      VALUES(%L,%L,%L,''bad.txt'',''text/plain'',1,decode(''61'',''hex''))',attempt1,eq2,s1),'23514');
  PERFORM pg_temp.qb_expect_error(format(
    'UPDATE exam_answer_files SET byte_size=2 WHERE attempt_id=%L',attempt1),'23514');

  UPDATE bank_questions SET question_text='Edited bank text',answer_key='{"correct_option_ids":["B"]}' WHERE id=bq1;
  PERFORM pg_temp.qb_assert((SELECT snapshot->>'question_text'='Original choice'
    AND snapshot->'answer_key'='{"correct_option_ids":["A"]}'::jsonb FROM exam_bank_questions WHERE exam_question_id=eq1),'editing bank preserves exam snapshot');
  PERFORM pg_temp.qb_assert(NOT EXISTS (
    (SELECT * FROM exam_results EXCEPT SELECT * FROM legacy_result_baseline)
    UNION ALL (SELECT * FROM legacy_result_baseline EXCEPT SELECT * FROM exam_results)
  ),'legacy attempts unchanged');
  PERFORM pg_temp.qb_assert(NOT EXISTS (
    (SELECT * FROM exam_questions EXCEPT SELECT * FROM legacy_question_baseline)
    UNION ALL (SELECT * FROM legacy_question_baseline EXCEPT SELECT * FROM exam_questions)
  ),'legacy questions and type CHECK unchanged');
END $$;
