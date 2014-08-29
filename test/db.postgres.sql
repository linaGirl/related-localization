

DROP SCHEMA IF EXISTS ee_orm_localization_test CASCADE;
CREATE SCHEMA ee_orm_localization_test;

CREATE TABLE ee_orm_localization_test.event (
      id                serial NOT NULL
    , CONSTRAINT "pk_event" PRIMARY KEY (id)
);

CREATE TABLE ee_orm_localization_test.language (
      id                serial NOT NULL
    , code              varchar(2)
    , CONSTRAINT "pk_language" PRIMARY KEY (id)
);

CREATE TABLE ee_orm_localization_test."eventLocale" (
      id_event          integer NOT NULL
    , id_language       integer NOT NULL
    , description       text
    , title             text
    , CONSTRAINT "pk_eventLocale" PRIMARY KEY (id_event, id_language)
    , CONSTRAINT "fk_eventLocale_event" FOREIGN KEY (id_event) REFERENCES ee_orm_localization_test.event (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE CASCADE
    , CONSTRAINT "fk_eventLocale_language" FOREIGN KEY (id_language) REFERENCES ee_orm_localization_test.language (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE RESTRICT
);