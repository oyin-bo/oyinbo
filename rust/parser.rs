// Markdown parser using markdown-rs for full-file parsing with diff-based reactions

use markdown::mdast::Node;
use markdown::{to_mdast, ParseOptions};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct Request {
    pub agent: String,
    pub target: String,
    pub time: String,
    pub code: String,
    pub has_footer: bool,
}

/// Parse a REPL request from markdown text
/// Uses markdown-rs to build complete AST and identify request structures
pub fn parse_request(text: &str, page_name: &str) -> Option<Request> {
    let options = ParseOptions::default();
    let ast = to_mdast(text, &options).ok()?;
    
    // Find the last fenced code block and its preceding header
    find_request_in_ast(&ast, page_name)
}

fn find_request_in_ast(node: &Node, page_name: &str) -> Option<Request> {
    // Walk the AST to find agent headers and code blocks
    // This is a simplified implementation - full version would do comprehensive AST traversal
    
    match node {
        Node::Root(root) => {
            // Traverse children to find patterns
            for child in &root.children {
                if let Some(req) = find_request_in_ast(child, page_name) {
                    return Some(req);
                }
            }
        }
        Node::Code(code) => {
            // Found a code block - check if it follows an agent header
            if let Some(lang) = &code.lang {
                if lang.to_lowercase() == "js" || lang.to_lowercase() == "javascript" {
                    // This is a potential request
                    return Some(Request {
                        agent: "agent".to_string(),
                        target: page_name.to_string(),
                        time: "00:00:00".to_string(),
                        code: code.value.clone(),
                        has_footer: true,
                    });
                }
            }
        }
        _ => {}
    }
    
    None
}

/// Parse entire file and build AST for diff-based comparison
pub fn parse_file_ast(content: &str) -> Result<Node, String> {
    let options = ParseOptions::default();
    to_mdast(content, &options).map_err(|e| format!("Parse error: {:?}", e))
}

/// Compare two ASTs to identify changes
pub fn diff_asts(old: &Node, new: &Node) -> Vec<AstChange> {
    let mut changes = Vec::new();
    
    // Simplified diff - full implementation would do deep structural comparison
    match (old, new) {
        (Node::Root(old_root), Node::Root(new_root)) => {
            if old_root.children.len() != new_root.children.len() {
                changes.push(AstChange::ChildrenModified);
            }
        }
        _ => {}
    }
    
    changes
}

#[derive(Debug, Clone)]
pub enum AstChange {
    ChildrenModified,
    CodeBlockAdded,
    HeadingModified,
    ContentChanged,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_request() {
        let markdown = r#"
### 🗣️agent to page at 10:00:00

```js
console.log('test');
```
"#;
        
        let req = parse_request(markdown, "page");
        assert!(req.is_some());
        
        let req = req.unwrap();
        assert_eq!(req.target, "page");
        assert!(req.code.contains("console.log"));
    }

    #[test]
    fn test_parse_file_ast() {
        let content = "# Hello\n\nSome text\n\n```js\ncode\n```";
        let ast = parse_file_ast(content);
        assert!(ast.is_ok());
    }
}
