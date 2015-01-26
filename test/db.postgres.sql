

DROP SCHEMA IF EXISTS ee_orm_localization_test CASCADE;
CREATE SCHEMA ee_orm_localization_test;

CREATE TABLE ee_orm_localization_test.venue (
      id                serial NOT NULL
    , CONSTRAINT "pk_venue" PRIMARY KEY (id)
);

CREATE TABLE ee_orm_localization_test.event (
      id                serial NOT NULL
    , id_venue          integer NOT NULL
    , CONSTRAINT "pk_event" PRIMARY KEY (id)
    , CONSTRAINT "fk_event_language" FOREIGN KEY (id_venue) REFERENCES ee_orm_localization_test.venue (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE RESTRICT
);



CREATE TABLE ee_orm_localization_test.language (
      id                serial NOT NULL
    , code              varchar(2)
    , CONSTRAINT "pk_language" PRIMARY KEY (id)
);

CREATE TABLE ee_orm_localization_test."languageLocale" (
      id_language       integer NOT NULL
    , id_languageLocale integer NOT NULL
    , name              text
    , CONSTRAINT "pk_languageLocale" PRIMARY KEY (id_languageLocale, id_language)
    , CONSTRAINT "fk_languageLocale_languageLocale" FOREIGN KEY (id_languageLocale) REFERENCES ee_orm_localization_test.language (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE RESTRICT
    , CONSTRAINT "fk_languageLocale_language" FOREIGN KEY (id_language) REFERENCES ee_orm_localization_test.language (id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE RESTRICT
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