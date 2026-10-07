import csv
import io
import json
import os
import sys
import urllib.request

def extract_tem8_words():
    url = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
    print(f"Connecting to ECDICT at {url}...")
    
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    
    tem8_words = []
    total_lines = 0
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            text_stream = io.TextIOWrapper(resp, encoding="utf-8", errors="replace")
            reader = csv.reader(text_stream)
            
            header = next(reader)
            print("ECDICT Columns:", header)
            
            # Find indices
            word_idx = header.index("word") if "word" in header else 0
            trans_idx = header.index("translation") if "translation" in header else 3
            def_idx = header.index("definition") if "definition" in header else 2
            pos_idx = header.index("pos") if "pos" in header else 4
            tag_idx = header.index("tag") if "tag" in header else 7
            frq_idx = header.index("frq") if "frq" in header else 9
            
            for row in reader:
                total_lines += 1
                if len(row) <= tag_idx:
                    continue
                
                tag = row[tag_idx].strip()
                if "tem8" in tag.split() or "tem8" in tag:
                    word = row[word_idx].strip()
                    # Filter out phrases with spaces or punctuation, focus on single words
                    if word.isalpha() and len(word) >= 3:
                        tem8_words.append({
                            "word": word.lower(),
                            "translation": row[trans_idx].strip().replace("\\n", "\n"),
                            "definition": row[def_idx].strip().replace("\\n", "\n"),
                            "pos": row[pos_idx].strip(),
                            "tag": tag,
                            "frq": int(row[frq_idx]) if frq_idx < len(row) and row[frq_idx].isdigit() else 999999
                        })
                
                if total_lines % 100000 == 0:
                    print(f"Processed {total_lines} lines, found {len(tem8_words)} TEM-8 words so far...")
                    
        print(f"Finished processing {total_lines} lines.")
        print(f"Total TEM-8 words extracted: {len(tem8_words)}")
        
        # Deduplicate by word
        unique_words = {}
        for item in tem8_words:
            w = item["word"]
            if w not in unique_words:
                unique_words[w] = item
                
        sorted_words = sorted(list(unique_words.values()), key=lambda x: x["frq"])
        
        out_dir = os.path.dirname(os.path.abspath(__file__))
        out_path = os.path.join(out_dir, "tem8_words.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(sorted_words, f, ensure_ascii=False, indent=2)
            
        print(f"Successfully saved {len(sorted_words)} unique TEM-8 words to {out_path}")
        return sorted_words
        
    except Exception as e:
        print(f"Error during extraction: {e}")
        sys.exit(1)

if __name__ == "__main__":
    extract_tem8_words()
