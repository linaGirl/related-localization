!function() {
    'use strict';


    var   Class         = require('ee-class')
        , log           = require('ee-log')
        , type          = require('ee-types')
        , async         = require('ee-async')
        , Promise       = (Promise || require('es6-promise').Promise)
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
            if (!ORM) ORM = this.orm.getORM();

            // storage
            this._storage = {};

            // the user may define the name of the language table
            if (options && options.languageTable)   this.languageTable  = options.languageTable;
            if (options && options.codeField)       this.codeField      = options.codeField;
        }





        /**
         * gets called before a model is saved
         *
         * @param <object> model
         * @param <object> transaction
         * @param <function> callback
         */
        , onAfterSave: function(model, transaction, callback) {
            var   databaseName = model._getDatabase().getDatabaseName()
                , tableName = model.getEntityName()
                , records = {}
                , changedValues = [];

            if (!model.getDefinition().isLocalizedTable) return callback();


            // is there any data set
            if (!type.object(model._localizedValues)) return callback();


            // check if the mode._serialize object contains properties
            // that are managed by us
            Object.keys(model._localizedValues).forEach(function(propertyName) {
                var id, config;

                if (this._storage[databaseName][tableName][propertyName]) {
                    // hit, we need to load the local records in order to be able to compare
                    // them to the new values. if the localized values are all empty we're
                    // going to delete the entire record. else its saved. if it
                    // doesn't exist we have to create them

                    // cache the config
                    config = this._storage[databaseName][tableName][propertyName];

                    // dcollect the definition of all changes
                    if (!records[databaseName]) records[databaseName] = {};
                    if (!records[databaseName][config.mappingName]) records[databaseName][config.mappingName] = {config: config, values: {}};
                    records[databaseName][config.mappingName].values[propertyName] = model._localizedValues[propertyName];
                }
            }.bind(this));
    

            

            // load records
            Promise.all(Object.keys(records).map(function(dbName) {
                return Promise.all(Object.keys(records[dbName]).map(function(table) {
                    var   mappingFilter = {}
                        , languageFilter = {}
                        , config = records[dbName][table].config
                        , values = records[dbName][table].values;


                    mappingFilter[config.referencingColumn] = model[config.referencedColumn];
                    languageFilter[this.codeField] = model._language;


                    // get record
                    return this.orm[dbName][table](mappingFilter).get(this.languageTable, languageFilter).findOne(transaction).then(function(mappingRecord) {
                        var hasValues, langFilter;

                        if (!mappingRecord) {
                            langFilter = {};
                            langFilter[this.codeField] = model._language;

                            mappingRecord = new this.orm[dbName][table]();
                            mappingRecord[config.referencingColumn] = model[config.referencedColumn];
                            mappingRecord[this.languageTable] = this.orm[dbName][this.languageTable](langFilter);
                        }

                        Object.keys(values).forEach(function(prop) {
                            mappingRecord[prop] = values[prop];
                        }.bind(this));


                        // check if there is anythin left on the record
                        hasValues = Object.keys(mappingRecord.toJSON()).some(function(propName) {
                            return (mappingRecord[propName] !== null && mappingRecord[propName] !== undefined && config.primaryKeys.indexOf(propName) === -1);
                        }.bind(this));

                        records[dbName][table].data = mappingRecord;
   
                        // delete if there are no values execpt the pks
                        if (hasValues) return mappingRecord.save(transaction);
                        else {
                            if (mappingRecord.isFromDatabase()) return mappingRecord.delete(transaction);
                            else return Promise.resolve();
                        }
                    }.bind(this));
                }.bind(this)));
            }.bind(this))).then(function() {

                // set values from mapping
                Object.keys(records).forEach(function(dbName) {
                    Object.keys(records[dbName]).forEach(function(tableName) {
                        var item = records[dbName][tableName];

                        Object.keys(item.data.toJSON()).forEach(function(propertyName) {
                            if (item.config.primaryKeys.indexOf(propertyName) === -1 && type.string(item.data[propertyName])) {
                                model[propertyName] = item.data[propertyName];
                            }
                        }.bind(this));
                    }.bind(this));
                }.bind(this));

                // deon
                callback();
            }).catch(callback);            
        }





        /*
         * we have to add our locale queries (sub selects)
         */
        , onBeforePrepareSubqueries: function(resource, definition) {
            var   selected = resource.getQuery().select
                , subSelected = {};

            if (!resource.getDefinition().isLocalizedTable) return;

            // we need to check if we nede to get the language data
            selected.some(function(selection) {
                if (this._storage[resource.databaseName] && this._storage[resource.databaseName][resource.name]) {
                    if (this._storage[resource.databaseName][resource.name][selection]) {
                        // specific field was selected
                        this._addSubSelect(selection, resource);
                        subSelected[selection] = true;
                    }
                }
            }.bind(this));


            // check if everything must be selected
            if (selected.selectAll) {
                Object.keys(this._storage[resource.databaseName][resource.name]).forEach(function(columnName) {
                    if (!subSelected[columnName]) {
                        this._addSubSelect(columnName, resource);
                        subSelected[columnName] = true;
                    }
                }.bind(this));
            }
    

            // remove all fields from the select of the original query
            // that belong to us
            selected.forEach(function(select, index) { 

                // check if this is a locel or not
                if (subSelected[select]) {
                    // we make use of thid column, remove it from the 
                    // original selection
                    selected.splice(index, 1);
                }
            }.bind(this))
        }




        /**
         * called by the orm
         */
        , onBeforePrepare: function(resource, definition) {
            if (!resource.getDefinition().isLocalizedTable) return;
            if (!resource.languageSelection) return;

            // prepare selected items
            thisContext.onBeforePrepareSubqueries(resource, definition);

            // prepare filters
            thisContext.prepareFilters(resource, definition);

            // ORDER STATEMENT
            thisContext.prepareOrder(resource);
        }
    



        /**
         * prepare the order statement
         *
         */
        , prepareOrder: function(resource) {
            var   localEntity = this._storage[resource.databaseName][resource.name]
                , orderStatements;

            if (resource.query.order && resource.query.order.length) {
                orderStatements = resource.query.order;

                orderStatements.forEach(function(order) {
                    if (order.entity = resource.name) {
                        if (this._storage[resource.databaseName][resource.name][order.property]) {
                            var name = resource.queryBuilder.join(this._storage[resource.databaseName][resource.name][order.property].mappingName, true).getresource().getAliasName();
                            order.entity = name;   
                        }
                    }
                }.bind(this));
            }
        }





        /**
         * check if th euser tried to filter a localized field, move the filter to that entity
         */
        , prepareFilters: function(resource, definition) {
            var   localEntity = this._storage[resource.databaseName][resource.name]
                , filter;

            if (resource.query.filter) {
                this._processFilter(resource.query.filter, '', resource.name, localEntity, Object.keys(this._storage[resource.databaseName][resource.name]), resource);
            }
        }






        /**
         * a littlebit of a crzy method to make the filters work with the language tables
         */
        , _processFilter: function(node, parentPropertyName, sourceTableName, localEntity, targetedProperties, resource) {

            if (type.array(node)) {
                node.forEach(function(subNode) {
                    this._processFilter(subNode, parentPropertyName, sourceTableName, localEntity, targetedProperties, resource);
                }.bind(this));
            }
            else if (node !== null && type.object(node)) {
                Object.keys(node).forEach(function(propertyName) {
                    var mappingName;

                    if (type.object(node[propertyName])) {
                        this._processFilter(node[propertyName], (propertyName === '_' ? parentPropertyName : propertyName), sourceTableName, localEntity, targetedProperties, resource);
                    }
                    else {

                        // is this a field we're targeting?
                        if (parentPropertyName === sourceTableName && targetedProperties.indexOf(propertyName) >= 0) {
                            // ok, structure, table & properties match

                            // get the alias name, force the loceale tble to be joined
                            mappingName = resource.queryBuilder.join(localEntity[propertyName].mappingName, true).getresource().getAliasName();

                            node[mappingName] = {};
                            node[mappingName][propertyName] = node[propertyName];
                           

                            delete node[propertyName];
                        }
                    }
                }.bind(this));
            }
        }




        , _addSubSelect: function(fieldName, resource) {
            if (!resource.getDefinition().isLocalizedTable) return;

            var   definition        = this._storage[resource.databaseName][resource.name][fieldName]
                , mappingName       = definition.mappingName
                , referencingColumn = definition.referencingColumn
                , referencedColumn  = definition.referencedColumn
                , languageSelection = this._getLanguageSelection(resource)
                , mappingFilter
                , filter;


            if (languageSelection && (!resource._localizedSelection || !resource._localizedSelection[fieldName])) {
                if (!resource._localizedSelection) resource._localizedSelection = {};
                resource._localizedSelection[fieldName] = true;

                filter = {};
                filter[this.codeField] = ORM.in(languageSelection);

                mappingFilter = {};
                mappingFilter[referencingColumn] = ORM.reference(resource.name, referencedColumn);
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
            else return null;
        }


        , setQueryLanguageSelection: function(languageSelection) {
            this.getrootResource().languageSelection = languageSelection;
            return this;
        }


        /**
         * set the language on the model
         */
        , setLanguage: function(language) {
            if (!type.string(language) || language.length !== 2) throw('Cannot set language on «'+this.getEntityName()+'», expected 2 character language code. got «'+language+'»!');
            else this._language = language;

            return this;
        }


        /*
         * checks if this extension should be used on the current model
         * methods and properties may be installed on the models prototype
         */
        , applyModelMethods: function(definition, classDefinition) {
            
            // the user may define in which language the fields
            // need to be saved
            classDefinition.setLocale = this.setLanguage;

            // stop here, the table has no localization
            if (!definition.isLocalizedTable) return;


            Object.keys(this._storage[definition.databaseName][definition.name]).forEach(function(columnName) {
                classDefinition[columnName] = {
                      get: function() {
                        return this._localizedValues && this._localizedValues[columnName] ? this._localizedValues[columnName] : undefined;
                    }
                    , set: function(value) {
                        if (!this._localizedValues) this._localizedValues = {};

                        if (this._localizedValues[columnName] !== value) {
                            this._localizedValues[columnName] = value;
                            this._setChanged();
                        }
                    }
                    , enumerable: true
                };

                if (!classDefinition._serialize) classDefinition._serialize = [];

                classDefinition._serialize.push(columnName); 
            }.bind(this));
        }


        /*
         * checks if this extension should be used on the current querybuilder
         * methods and properties may be installed on the models prototype
         */
        , applyQueryBuilderMethods: function(definition, classDefinition) {

            // the user has to define which languages he likes to load
            // on the current query
            classDefinition.setLocale = this.setQueryLanguageSelection;
        }


        /*
         * checks if this extension should be applied to the 
         * current model
         */
        , useOnModel: function(definition) {
            var   mappingDefinition
                , resultColumn;

            // say yes if this table maps to the language table
            if (Object.keys(definition.columns).some(function(columnName) {
                var column = definition.columns[columnName];

                return column && column.mapsTo && column.mapsTo.some(function(mapping){
                    if (mapping.name === this.languageTable) {
                        mappingDefinition = mapping;
                        resultColumn = column;
                        //log(definition);
                        return true;
                    }
                    else return false;
                }.bind(this));
            }.bind(this))) {

                // this model has a locale table
                var config = {
                      mappingName       : mappingDefinition.via.model.name
                    , primaryKeys       : mappingDefinition.via.model.primaryKeys
                    , referencingColumn : mappingDefinition.via.fk
                    , referencedColumn  : resultColumn.name
                };

                // we need to store which columns map to which table
                if (!this._storage[definition.databaseName]) this._storage[definition.databaseName] = {};
                if (!this._storage[definition.databaseName][definition.name]) this._storage[definition.databaseName][definition.name] = {};

                Object.keys(mappingDefinition.via.model.columns).forEach(function(col) {
                    var localColumn = mappingDefinition.via.model.columns[col];
                    if (!localColumn.isPrimary && localColumn.name !== this.codeField) {
                        this._storage[definition.databaseName][definition.name][localColumn.name] = config;
                    }
                }.bind(this));

                // mark as localized
                definition.isLocalizedTable = true;

                // tell to use this extension on this table
                return true;
            }
            else {
                // mark as NOT localized
                definition.isLocalizedTable = false;

                // apply the setlocale method anyway
                return true;
            }
        }
    });
}();
 