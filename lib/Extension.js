!function() {
    'use strict';


    var   Class         = require('ee-class')
        , log           = require('ee-log')
        , type          = require('ee-types')
        , async         = require('ee-async')
        , ORMExtension  = require('ee-orm-extension');


    var   thisContext
        , ORM;


    module.exports = new Class({
        inherits: ORMExtension

        , languageTable: 'language'
        , codeField: 'code'


        , _name: 'localized'


        , init: function init(options) {
            init.super.call(this);

            // we need to build queries
            this.orm = options.orm;

            // store this context so we'll have acces in some 
            // methods attached to the model
            thisContext = this;

            // get the orm object
            if (ORM) ORM = this.orm.getORM();


            // storage
            this._database = {};

            // the user may define the name of the language table
            if (options && options.languageTable)   this.languageTable  = options.languageTable;
            if (options && options.codeField)       this.codeField      = options.codeField;
        }


        /*
         * we have to add our locale queries (sub selects)
         */
        , beforePrepareSubqueries: function(resource, definition) {
            // we need to check if we nede to get the language data
            resource.query.select.some(function(selection) {
                if (selection === '*') {
                    // we need to select the language table, all fieds


                    // stop, we've already selected everything
                    return true;
                }
                else if (this._database[resource.databaseName] && this._database[resource.databaseName]._table[resource.name] && this._database[resource.databaseName]._table[resource.name].column[selection]) {
                    // specific field was selected

                }
            }.bind(this));
        }


        , _addSubSelect: function(fieldName, resource) {
            var   definition        = this._database[resource.databaseName]._table[resource.name].column[fieldName]
                , mappingName       = definition.mappingName
                , referencingColumn = definition.referencingColumn
                , referencedColumn  = definition.referencedColumn
                , languageSelection = this._getLanguageSelection(resource)
                , mappingFilter
                , filter;

            if (!resource._subsSelected || !resource._subsSelected[fieldName]) {
                if (!resource._subsSelected) resource._subsSelected = {};
                resource._subsSelected[fieldName] = true;

                filter = {};
                filter[this.codeField] = ORM.in(languageSelection);

                mappingFilter = {};
                mappingFilter[referencingColumn] = ORM.reference(resource.getAliasName(), referencedColumn);
                mappingFilter[fieldName] = ORM.notNull();

                resource.selectColumn({
                      query: this.orm[resource.databaseName][mappingName]([fieldName], mappingFilter).limit(1).get(this.languageTable, filter).orderRoot(this.codeField, false, languageSelection)
                    , alias: fieldName
                });
            }
        }


        , _getLanguageSelection: function(resource) {
            if (resource.languageSelection) return resource.languageSelection;
            else if (resource.hasParent()) return this._getLanguageSelection(resource.getParent());
            else return [];
        }


        , setQueryLanguageSelection: function(languageSelection) {
            this.resource.languageSelection = languageSelection;
        }


        /*
         * checks if this extension should be used on the current model
         * methods and properties may be installed on the models prototype
         */
        , applyModelMethods: function(definition, classDefinition) {
                
            // the user may define in which language the fields
            // need to be saved
            classDefinition.setLanguage = this.setLanguage;
        }


        /*
         * checks if this extension should be used on the current querybuilder
         * methods and properties may be installed on the models prototype
         */
        , applyQueryBuilderMethods: function(definition, classDefinition) {

            // the user has to define which languages he likes to load
            // on the current query
            classDefinition.languages = this.setQueryLanguageSelection;
        }


        /*
         * checks if this extension should be applied to the 
         * current model
         */
        , useOnModel: function(definition) {
            // say yes if this table maps to the language table
            return Object.keys(definition.columns).some(function(columnName) {
                var column = definition.columns[columnName];
                return column && column.mapsTo && column.mapsTo.some(function(mapping){ return mapping.name === this.languageTable; }.bind(this));
            }.bind(this));
        }
    });
}();
