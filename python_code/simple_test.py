#!/usr/bin/env python3
"""
Simple CozoDB + RocksDB Test
Reads data and datalog scripts from JSON files
"""

import os
import shutil
import json
from pathlib import Path

def create_relation(relation_name: str, types_dict: dict):
    """
    Create a relation with the given name and types

    Args:
        relation_name (str): Name of the relation to create
        types_dict (dict): Dictionary mapping column names to their types

    Returns:
        str: CozoDB datalog script to create the relation
    """
    # Build the column list for the query part
    columns = list(types_dict.keys())
    column_list = ", ".join(columns)

    # Build the schema definition part
    schema_parts = []
    for column_name, column_type in types_dict.items():
        schema_parts.append(f"    {column_name}: {column_type}")
    schema_definition = ",\n".join(schema_parts)

    # Construct the full datalog script
    datalog_script = f"""?[{column_list}] <- []
:create {relation_name} {{
{schema_definition}
}}"""

    return datalog_script

def create_stored_relation(relation_name: str, fields: list, primary_key_count: int = 1):
    """
    Create a stored relation in CozoDB based on a set of fields
    The first set of fields will be the primary key and the rest will be other fields

    Args:
        relation_name (str): Name of the relation to create
        fields (list): List of field dictionaries with 'name' and 'type' keys
        primary_key_count (int): Number of fields to use as primary key (default: 1)

    Returns:
        str: CozoDB datalog script to create the stored relation
    """
    # Validate inputs
    if not relation_name or not isinstance(fields, list) or len(fields) == 0:
        raise ValueError("Invalid parameters: relation_name and fields list are required")

    if not 1 <= primary_key_count <= len(fields):
        raise ValueError(f"Invalid primary_key_count: must be between 1 and {len(fields)}")

    # Separate primary key fields from other fields
    primary_key_fields = fields[:primary_key_count]
    other_fields = fields[primary_key_count:]

    # Build field definitions for the relation schema
    field_definitions = []
    for field in fields:
        field_name = field.get('name')
        field_type = field.get('type', 'String')  # Default to String if type not specified

        # Validate field name and type
        if not field_name or not isinstance(field_name, str):
            raise ValueError("Field name must be a non-empty string")

        field_definitions.append(f"    {field_name}: {field_type}")

    # Build primary key definition
    primary_key_columns = [field['name'] for field in primary_key_fields]
    primary_key_definition = f'primary_key: [{", ".join(f'"{name}"' for name in primary_key_columns)}]'

    # Construct the complete relation definition
    schema_definition = ",\n".join(field_definitions + [f"    {primary_key_definition}"])

    # Build column list for the query part
    column_list = ", ".join(field['name'] for field in fields)

    # Construct the full datalog script
    datalog_script = f"""?[{column_list}] <- []
:create {relation_name} {{
{schema_definition}
}}"""

    return datalog_script

def insert_data(relation_name: str, data: list, column_names: list = None):
    """
    Insert data into a relation
    
    Args:
        relation_name (str): Name of the relation to insert data into
        data (list): List of tuples/rows to insert
        column_names (list): List of column names (optional)
    
    Returns:
        str: CozoDB datalog script to insert the data
    """
    if not data:
        return ""
    
    # Get column count from first row
    num_columns = len(data[0])
    
    # Use provided column names or create generic placeholders
    if column_names and len(column_names) == num_columns:
        columns = column_names
    else:
        columns = [f"col_{i}" for i in range(num_columns)]
    
    column_list = ", ".join(columns)
    
    # Create the datalog script
    datalog_script = f"?[{column_list}] <- $data\n:replace {relation_name}"
    
    return datalog_script

def load_config(config_file: str = "test_data.json"):
    """Load configuration from JSON file"""
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"❌ Config file {config_file} not found")
        return None
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in {config_file}: {e}")
        return None

def execute_datalog(db, script_template: str, params: dict = None, table_name: str = None):
    """Execute a datalog script with parameter substitution"""
    # Replace table name placeholder safely
    if table_name:
        script = script_template.replace("{table_name}", table_name)
    else:
        script = script_template
    
    # Execute with parameters
    if params:
        return db.run(script, params)
    else:
        return db.run(script)

def test_cozodb(config_file: str = "test_data.json"):
    """Test CozoDB with configuration from JSON file"""
    print("🚀 Testing CozoDB with RocksDB...")
    
    # Load configuration
    config = load_config(config_file)
    if not config:
        return False
    
    data_store_name = config["data_store_name"]
    table_name = config["table_name"]
    
    # Ensure data directory exists
    data_dir = Path("../data")
    data_dir.mkdir(exist_ok=True)
    db_path = data_dir / data_store_name
    
    # Remove existing database if it exists
    if db_path.exists():
        if db_path.is_dir():
            shutil.rmtree(db_path)
        else:
            os.remove(db_path)
    
    try:
        # Import and connect to CozoDB
        from pycozo.client import Client
        db = Client("rocksdb", str(db_path))
        print(f"✅ Connected to CozoDB database: {db_path}")
        
        # Create table using script from JSON
        create_script = config["create_table_script"]
        execute_datalog(db, create_script, table_name=table_name)
        print(f"✅ Created table: {table_name}")
        
        # Insert data using script from JSON
        insert_script = config["datalog_script"]
        execute_datalog(db, insert_script, {"data": config["data"]}, table_name=table_name)
        print(f"✅ Inserted {len(config['data'])} records")
        
        # Query data using script from JSON
        query_script = config["query_script"]
        result = execute_datalog(db, query_script, table_name=table_name)
        print(f"✅ Query successful - found {len(result)} records")
        
        # Test filter using script from JSON
        filter_script = config["filter_script"]
        filter_result = execute_datalog(db, filter_script, {"search_id": "1"}, table_name=table_name)
        print(f"✅ Filter test successful - found {len(filter_result)} matching records")
        
        print("🎉 CozoDB with RocksDB is working!")
        return True
        
    except ImportError:
        print("❌ pycozo package not found. Install with: pip install pycozo")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return False

if __name__ == "__main__":
    # Example 1: Traditional create_relation function
    print("=== Example 1: Traditional Users Relation ===")
    users_types = {
        "user_id": "String",
        "name": "String",
        "age": "Int",
        "email": "String",
        "is_active": "Bool"
    }

    users_script = create_relation("users", users_types)
    print(users_script)
    print()

    # Example 2: New create_stored_relation function with flexible primary keys
    print("=== Example 2: Flexible Stored Relations ===")

    # Recipe ingredients relation with 2 primary key fields
    recipe_ingredients_fields = [
        {"name": "recipe_id", "type": "String"},
        {"name": "ingredient_id", "type": "String"},
        {"name": "ingredient_name", "type": "String"},
        {"name": "quantity", "type": "Float"},
        {"name": "unit", "type": "String"},
        {"name": "notes", "type": "String"}
    ]

    recipe_ingredients_script = create_stored_relation("recipe_ingredients", recipe_ingredients_fields, 2)
    print("Recipe Ingredients Relation (2 primary keys):")
    print(recipe_ingredients_script)
    print()

    # Order items relation with 2 primary key fields
    order_items_fields = [
        {"name": "order_id", "type": "String"},
        {"name": "item_id", "type": "String"},
        {"name": "product_name", "type": "String"},
        {"name": "quantity", "type": "Int"},
        {"name": "price", "type": "Float"},
        {"name": "discount", "type": "Float"}
    ]

    order_items_script = create_stored_relation("order_items", order_items_fields, 2)
    print("Order Items Relation (2 primary keys):")
    print(order_items_script)
    print()

    # Simple users relation with 1 primary key (default)
    users_fields = [
        {"name": "user_id", "type": "String"},
        {"name": "username", "type": "String"},
        {"name": "email", "type": "String"},
        {"name": "age", "type": "Int"},
        {"name": "is_active", "type": "Bool"}
    ]

    users_stored_script = create_stored_relation("users_stored", users_fields, 1)
    print("Users Stored Relation (1 primary key, default):")
    print(users_stored_script)
    print()

    # Example with custom types and more complex primary key
    complex_fields = [
        {"name": "tenant_id", "type": "String"},
        {"name": "user_id", "type": "String"},
        {"name": "session_id", "type": "String"},
        {"name": "created_at", "type": "String"},
        {"name": "last_activity", "type": "String"},
        {"name": "is_active", "type": "Bool"}
    ]

    complex_script = create_stored_relation("user_sessions", complex_fields, 3)
    print("User Sessions Relation (3 primary keys):")
    print(complex_script)
    print()

    # Example: Insert data into the users relation using the same data
    print("=== Inserting Data into Users Relation ===")
    users_data = [
        ["1", "Alice", 25, "alice@example.com", True],
        ["2", "Bob", 30, "bob@example.com", False],
        ["3", "Charlie", 35, "charlie@example.com", True]
    ]

    # Get column names from the types dictionary
    users_column_names = list(users_types.keys())

    insert_script = insert_data("users", users_data, users_column_names)
    print("Generated Datalog Script:")
    print(insert_script)
    print()
    print("Data to insert:")
    for row in users_data:
        print(f"  {row}")
    print()

    # Run the original CozoDB test
    print("=== Running CozoDB Test ===")
    test_cozodb() 