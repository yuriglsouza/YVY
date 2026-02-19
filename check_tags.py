
import re

def check_structure(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()

    stack = []
    # Regex to find tags: <TagName ...>, </TagName>, <TagName ... />
    # We ignore attributes.
    # Case 1: Closing tag like </div>
    # Case 2: Self closing like <div />
    # Case 3: Opening tag like <div ...>
    
    # Simple parser:
    # 1. remove comments (simplified)
    # 2. find tags
    
    tag_pattern = re.compile(r'</?([a-zA-Z0-9\.]+)([^>]*)/?>')
    
    for i, line in enumerate(lines):
        # strip simple comments? (risk of stripping url)
        # simplistic approach
        line_clean = line.split('//')[0] 
        
        matches = tag_pattern.finditer(line_clean)
        for match in matches:
            full_tag = match.group(0)
            tag_name = match.group(1)
            content = match.group(2)
            
            is_closing = full_tag.startswith('</')
            is_self_closing = full_tag.endswith('/>')
            
            # Filter void elements in HTML (img, br, input, etc) if necessary, 
            # but in JSX they usually must be self-closed or closed. 
            # <br> is invalid in JSX, must be <br/>.
            # So we assume strict JSX.
            
            if is_self_closing:
                continue
                
            if is_closing:
                if not stack:
                    print(f"Line {i+1}: Unexpected closing tag </{tag_name}> (Stack empty)")
                    return
                
                last_tag = stack[-1]
                if last_tag['name'] != tag_name:
                    print(f"Line {i+1}: Mismatch! Expected </{last_tag['name']}> (from line {last_tag['line']}), found </{tag_name}>")
                    return
                stack.pop()
            else:
                # Opening tag
                # Check if it is a known void element that might not be self-closed in sloppy JSX? 
                # No, assume strict.
                stack.append({'name': tag_name, 'line': i+1})

    if stack:
        print("Unclosed tags remaining:")
        for s in stack:
            print(f"  <{s['name']}> from line {s['line']}")
    else:
        print("Structure seems OK.")

check_structure("/Users/yuri/Desktop/Backup/Code-Robustness/client/src/pages/FarmDetails.tsx")
