class Station:
    id: str
    title: str
    final_url: str
    country: str
    country_id: int
    
    def __init__(self, id:str, title:str, final_url:str,country: str,country_id:int):
        self.id=id
        self.title=title
        self.final_url=final_url
        self.country = country
        self.country_id=country_id
    